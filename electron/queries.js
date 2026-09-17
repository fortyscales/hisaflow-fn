const { db } = require("./db");
const analyticsRepository = require("./repositories/analyticsRepository");
const crypto = require("crypto");
const { createInventoryService } = require("./domain/inventoryService");
const { createSalesService, SalesDomainError } = require("./domain/salesService");
const { createPurchaseService } = require("./domain/purchaseService");
const { createCreditService } = require("./domain/creditService");
const { createExpenseService } = require("./domain/expenseService");
const { createRepositories } = require("./repositories");
const { createTransactionRunner } = require("./domain/transactionRunner");

// Preserves the exact "get the whole array / save the whole array"
// interface every service in the renderer already calls — nothing in
// salesService, creditService, or any other service needs to change for
// this stage. What changes is what's behind that interface: instead of
// reading/writing a whole JSON file, saves now happen inside a real
// SQLite transaction (delete + re-insert, atomically) — which is what
// actually closes the race condition structurally, not just narrows it.
// The tradeoff being made deliberately here: this still moves whole
// tables at once rather than granular per-row queries, so the latency
// benefit of proper indexing comes in a later, separate stage that
// rewrites the services themselves — this stage is about correctness
// and safety first.

const productRowToObject = (p, batchesByProduct) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  brand: p.brand,
  size: p.size,
  unit: p.unit,
  sellingPrice: p.selling_price,
  buyingPrice: p.buying_price,
  stock: p.stock,
  imageUri: p.image_uri,
  expiryDate: p.expiry_date,
  createdAt: p.created_at,
  stockBatches: batchesByProduct[p.id] || [],
});

const batchRowToObject = (b) => ({
  id: b.id,
  quantity: b.quantity,
  remaining: b.remaining,
  buyingPrice: b.buying_price,
  date: b.date,
  supplierId: b.supplier_id,
  supplierName: b.supplier_name,
  paymentMethod: b.payment_method,
  accountId: b.account_id,
  accountLabel: b.account_label,
  accountNumber: b.account_number,
});

function getProducts() {
  const products = db.prepare("SELECT * FROM products").all();
  const batches = db
    .prepare("SELECT * FROM stock_batches WHERE remaining > 0 ORDER BY date ASC, id ASC")
    .all();
  const batchesByProduct = {};
  for (const b of batches) {
    (batchesByProduct[b.product_id] ||= []).push(batchRowToObject(b));
  }
  return products.map((p) => productRowToObject(p, batchesByProduct));
}

function getProductsForBackup() {
  const products = db.prepare("SELECT * FROM products").all();
  const batches = db.prepare("SELECT * FROM stock_batches ORDER BY date ASC, id ASC").all();
  const batchesByProduct = {};
  for (const b of batches) (batchesByProduct[b.product_id] ||= []).push(batchRowToObject(b));
  return products.map((p) => productRowToObject(p, batchesByProduct));
}

const saveProducts = db.transaction((products) => {
  db.prepare("DELETE FROM stock_batches").run();
  db.prepare("DELETE FROM products").run();

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, brand, size, unit, selling_price, buying_price, stock, image_uri, expiry_date, created_at)
    VALUES (@id, @name, @category, @brand, @size, @unit, @sellingPrice, @buyingPrice, @stock, @imageUri, @expiryDate, @createdAt)
  `);
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (@id, @productId, @quantity, @remaining, @buyingPrice, @date, @supplierId, @supplierName, @paymentMethod, @accountId, @accountLabel, @accountNumber)
  `);

  for (const p of products) {
    insertProduct.run({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      brand: p.brand ?? null,
      size: p.size ?? null,
      unit: p.unit || "pc",
      sellingPrice: p.sellingPrice || 0,
      buyingPrice: p.buyingPrice || 0,
      stock: p.stock || 0,
      imageUri: p.imageUri ?? null,
      expiryDate: p.expiryDate ?? null,
      createdAt: p.createdAt || new Date().toISOString(),
    });
    for (const b of p.stockBatches || []) {
      insertBatch.run({
        id: b.id,
        productId: p.id,
        quantity: b.quantity,
        remaining: b.remaining,
        buyingPrice: b.buyingPrice,
        date: b.date,
        supplierId: b.supplierId ?? null,
        supplierName: b.supplierName ?? null,
        paymentMethod: b.paymentMethod ?? null,
        accountId: b.accountId ?? null,
        accountLabel: b.accountLabel ?? null,
        accountNumber: b.accountNumber ?? null,
      });
    }
  }
});

// Granular product writes for normal UI operations. saveProducts remains only
// as a compatibility/restore primitive; routine edits must never rewrite the
// entire inventory table (or erase retained zero-balance FIFO history).
const upsertProductsTx = db.transaction((products) => {
  const getExisting = db.prepare("SELECT id FROM products WHERE id = ?");
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, brand, size, unit, selling_price, buying_price, stock, image_uri, expiry_date, created_at)
    VALUES (@id, @name, @category, @brand, @size, @unit, @sellingPrice, @buyingPrice, @stock, @imageUri, @expiryDate, @createdAt)
  `);
  const updateProduct = db.prepare(`
    UPDATE products SET name=@name, category=@category, brand=@brand, size=@size,
      unit=@unit, selling_price=@sellingPrice, image_uri=@imageUri, expiry_date=@expiryDate
    WHERE id=@id
  `);
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (@id, @productId, @quantity, @remaining, @buyingPrice, @date, @supplierId, @supplierName, @paymentMethod, @accountId, @accountLabel, @accountNumber)
  `);

  for (const p of products) {
    const params = {
      id: p.id, name: p.name, category: p.category ?? null, brand: p.brand ?? null,
      size: p.size ?? null, unit: p.unit || "pc", sellingPrice: Number(p.sellingPrice || 0),
      buyingPrice: Number(p.buyingPrice || 0), stock: Number(p.stock || 0),
      imageUri: p.imageUri ?? null, expiryDate: p.expiryDate ?? null,
      createdAt: p.createdAt || new Date().toISOString(),
    };
    if (getExisting.get(p.id)) {
      updateProduct.run(params);
    } else {
      insertProduct.run(params);
      for (const b of p.stockBatches || []) {
        insertBatch.run({
          id: b.id || genId("b"), productId: p.id,
          quantity: Number(b.quantity || 0), remaining: Number(b.remaining ?? b.quantity ?? 0),
          buyingPrice: Number(b.buyingPrice || 0), date: b.date || params.createdAt,
          supplierId: b.supplierId ?? null, supplierName: b.supplierName ?? null,
          paymentMethod: b.paymentMethod ?? null, accountId: b.accountId ?? null,
          accountLabel: b.accountLabel ?? null, accountNumber: b.accountNumber ?? null,
        });
      }
      // If imported data has stock but no batches, create one real batch.
      if (params.stock > 0 && !(p.stockBatches || []).length) {
        insertBatch.run({
          id: genId("b"), productId: p.id, quantity: params.stock, remaining: params.stock,
          buyingPrice: params.buyingPrice, date: params.createdAt,
          supplierId: null, supplierName: null, paymentMethod: null,
          accountId: null, accountLabel: null, accountNumber: null,
        });
      }
      recomputeProductSummary(p.id);
    }
  }
});

function upsertProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return { success: true };
  upsertProductsTx(products);
  return { success: true };
}

const deleteProductsTx = db.transaction((productIds) => {
  const del = db.prepare("DELETE FROM products WHERE id = ?");
  for (const id of productIds) del.run(id);
});

function deleteProducts(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return { success: true };
  deleteProductsTx(productIds);
  return { success: true };
}

const saleRowToObject = (s) => ({
  id: s.id, productId: s.product_id, productName: s.product_name, quantity: s.quantity,
  buyingPrice: s.buying_price, sellingPrice: s.selling_price, totalCost: s.total_cost,
  totalRevenue: s.total_revenue, profit: s.profit, paymentMethod: s.payment_method,
  accountId: s.account_id, accountLabel: s.account_label, accountNumber: s.account_number,
  notes: s.notes, date: s.date, editedAt: s.edited_at,
  batchBreakdown: s.batch_breakdown ? JSON.parse(s.batch_breakdown) : null,
  customerPhone: s.customer_phone, customerName: s.customer_name, discount: s.discount || 0,
  productCategory: s.product_category, productBrand: s.product_brand, productUnit: s.product_unit,
  productImageUri: s.product_image_uri, productSize: s.product_size, actorName: s.actor_name,
});

// Full history is retained for exports/reports/backups. Interactive screens should
// use getSalesPage so the renderer never has to deserialize years of sales just
// to display a single page.
function getSales() {
  return db.prepare("SELECT * FROM sales ORDER BY date DESC, id DESC").all().map(saleRowToObject);
}

function getSalesPage({ page = 1, pageSize = 24, search = "" } = {}) {
  const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 24));
  const safePage = Math.max(1, Number(page) || 1);
  const term = String(search || "").trim();
  const searchSql = term
    ? `WHERE product_name LIKE @q COLLATE NOCASE OR customer_name LIKE @q COLLATE NOCASE
       OR customer_phone LIKE @q COLLATE NOCASE OR payment_method LIKE @q COLLATE NOCASE
       OR actor_name LIKE @q COLLATE NOCASE`
    : "";
  const params = term ? { q: `%${term}%` } : {};

  // Sales history is a business transaction register, not just the physical
  // `sales` table. A credit sale remains a sale after its balance reaches zero.
  // Paid credit item lines therefore appear here as read-only history rows.
  // The payment itself is NOT another sale, so revenue is never counted twice.
  const historySql = `
    SELECT id, product_id, product_name, quantity, buying_price, selling_price,
      total_cost, total_revenue, profit, payment_method, account_id, account_label,
      account_number, notes, date, edited_at, batch_breakdown, customer_phone,
      customer_name, discount, product_category, product_brand, product_unit,
      product_image_uri, product_size, actor_name, 'paid' AS record_type,
      NULL AS credit_sale_id, NULL AS credit_status
    FROM sales
    UNION ALL
    SELECT csi.id AS id, csi.product_id, csi.product_name, csi.quantity,
      csi.cost_at_sale / NULLIF(csi.quantity, 0) AS buying_price,
      csi.selling_price,
      csi.cost_at_sale AS total_cost,
      csi.quantity * csi.selling_price AS total_revenue,
      (csi.quantity * csi.selling_price) - COALESCE(csi.cost_at_sale, 0) AS profit,
      COALESCE((SELECT p.payment_method FROM credit_sale_payments p
                WHERE p.credit_sale_id = cs.id ORDER BY p.date DESC, p.id DESC LIMIT 1), 'credit') AS payment_method,
      (SELECT p.account_id FROM credit_sale_payments p WHERE p.credit_sale_id = cs.id ORDER BY p.date DESC, p.id DESC LIMIT 1) AS account_id,
      (SELECT p.account_label FROM credit_sale_payments p WHERE p.credit_sale_id = cs.id ORDER BY p.date DESC, p.id DESC LIMIT 1) AS account_label,
      (SELECT p.account_number FROM credit_sale_payments p WHERE p.credit_sale_id = cs.id ORDER BY p.date DESC, p.id DESC LIMIT 1) AS account_number,
      'Paid credit sale' AS notes, cs.date, NULL AS edited_at, csi.batch_breakdown,
      cs.customer_phone, cs.customer_name, 0 AS discount, csi.product_category,
      csi.product_brand, csi.product_unit, csi.product_image_uri, csi.product_size,
      cs.actor_name, 'credit' AS record_type, cs.id AS credit_sale_id,
      cs.status AS credit_status
    FROM credit_sales cs
    JOIN credit_sale_items csi ON csi.credit_sale_id = cs.id
    WHERE cs.status = 'paid' OR cs.amount_paid >= cs.total_amount
  `;
  const filteredSql = `SELECT * FROM (${historySql}) history ${searchSql}`;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM (${filteredSql})`).get(params).n;
  const rows = db.prepare(`${filteredSql} ORDER BY date DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safeSize, offset: (safePage - 1) * safeSize });
  return {
    items: rows.map((r) => ({
      ...saleRowToObject(r),
      recordType: r.record_type,
      creditSaleId: r.credit_sale_id,
      creditStatus: r.credit_status,
    })),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
  };
}

const saveSales = db.transaction((sales) => {
  db.prepare("DELETE FROM sales").run();
  const insert = db.prepare(`
    INSERT INTO sales (id, product_id, product_name, quantity, buying_price, selling_price, total_cost, total_revenue, profit, payment_method, account_id, account_label, account_number, notes, date, edited_at, batch_breakdown, customer_phone, customer_name, discount, product_category, product_brand, product_unit, product_image_uri, product_size, actor_name)
    VALUES (@id, @productId, @productName, @quantity, @buyingPrice, @sellingPrice, @totalCost, @totalRevenue, @profit, @paymentMethod, @accountId, @accountLabel, @accountNumber, @notes, @date, @editedAt, @breakdownJson, @customerPhone, @customerName, @discount, @productCategory, @productBrand, @productUnit, @productImageUri, @productSize, @actorName)
  `);
  for (const s of sales) {
    insert.run({
      id: s.id,
      productId: s.productId,
      productName: s.productName,
      quantity: s.quantity,
      buyingPrice: s.buyingPrice ?? null,
      sellingPrice: s.sellingPrice,
      totalCost: s.totalCost ?? null,
      totalRevenue: s.totalRevenue,
      profit: s.profit,
      paymentMethod: s.paymentMethod ?? null,
      accountId: s.accountId ?? null,
      accountLabel: s.accountLabel ?? null,
      accountNumber: s.accountNumber ?? null,
      notes: s.notes ?? null,
      date: s.date,
      editedAt: s.editedAt ?? null,
      breakdownJson: s.batchBreakdown ? JSON.stringify(s.batchBreakdown) : null,
      customerPhone: s.customerPhone ?? null,
      customerName: s.customerName ?? null,
      discount: s.discount ?? 0,
      productCategory: s.productCategory ?? null,
      productBrand: s.productBrand ?? null,
      productUnit: s.productUnit ?? null,
      productImageUri: s.productImageUri ?? null,
      productSize: s.productSize ?? null,
      actorName: s.actorName ?? null,
    });
  }
});

function getCreditSales() {
  const creditSales = db.prepare("SELECT * FROM credit_sales").all();
  const items = db.prepare("SELECT * FROM credit_sale_items").all();
  const payments = db
    .prepare("SELECT * FROM credit_sale_payments ORDER BY date ASC")
    .all();

  const itemsBySale = {};
  for (const i of items) {
    (itemsBySale[i.credit_sale_id] ||= []).push({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      sellingPrice: i.selling_price,
      costAtSale: i.cost_at_sale,
      batchBreakdown: i.batch_breakdown ? JSON.parse(i.batch_breakdown) : null,
      productCategory: i.product_category,
      productBrand: i.product_brand,
      productUnit: i.product_unit,
      productImageUri: i.product_image_uri,
      productSize: i.product_size,
    });
  }
  const paymentsBySale = {};
  for (const p of payments) {
    (paymentsBySale[p.credit_sale_id] ||= []).push({
      amount: p.amount,
      paymentMethod: p.payment_method,
      date: p.date,
    });
  }

  return creditSales.map((cs) => ({
    id: cs.id,
    customerName: cs.customer_name,
    customerPhone: cs.customer_phone,
    totalAmount: cs.total_amount,
    amountPaid: cs.amount_paid,
    status: cs.status,
    date: cs.date,
    items: itemsBySale[cs.id] || [],
    payments: paymentsBySale[cs.id] || [],
    actorName: cs.actor_name,
  }));
}

const saveCreditSales = db.transaction((creditSales) => {
  db.prepare("DELETE FROM credit_sale_items").run();
  db.prepare("DELETE FROM credit_sale_payments").run();
  db.prepare("DELETE FROM credit_sales").run();

  const insertCreditSale = db.prepare(`
    INSERT INTO credit_sales (id, customer_name, customer_phone, total_amount, amount_paid, status, date, actor_name)
    VALUES (@id, @customerName, @customerPhone, @totalAmount, @amountPaid, @status, @date, @actorName)
  `);
  const insertItem = db.prepare(`
    INSERT INTO credit_sale_items (id, credit_sale_id, product_id, product_name, quantity, selling_price, cost_at_sale, batch_breakdown, product_category, product_brand, product_unit, product_image_uri, product_size)
    VALUES (@id, @creditSaleId, @productId, @productName, @quantity, @sellingPrice, @costAtSale, @breakdownJson, @productCategory, @productBrand, @productUnit, @productImageUri, @productSize)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO credit_sale_payments (id, credit_sale_id, amount, payment_method, date)
    VALUES (@id, @creditSaleId, @amount, @paymentMethod, @date)
  `);
  const genId = (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  for (const cs of creditSales) {
    insertCreditSale.run({
      id: cs.id,
      customerName: cs.customerName,
      customerPhone: cs.customerPhone ?? null,
      totalAmount: cs.totalAmount,
      amountPaid: cs.amountPaid || 0,
      status: cs.status || "pending",
      date: cs.date,
      actorName: cs.actorName ?? null,
    });
    for (const item of cs.items || []) {
      // Items/payments never carried their own id in the JSON shape —
      // generate one fresh each save, same as the migration did.
      insertItem.run({
        id: genId("cci"),
        creditSaleId: cs.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: item.costAtSale ?? null,
        breakdownJson: item.batchBreakdown
          ? JSON.stringify(item.batchBreakdown)
          : null,
        productCategory: item.productCategory ?? null,
        productBrand: item.productBrand ?? null,
        productUnit: item.productUnit ?? null,
        productImageUri: item.productImageUri ?? null,
        productSize: item.productSize ?? null,
      });
    }
    for (const pmt of cs.payments || []) {
      insertPayment.run({
        id: genId("ccp"),
        creditSaleId: cs.id,
        amount: pmt.amount,
        paymentMethod: pmt.paymentMethod ?? null,
        date: pmt.date,
      });
    }
  }
});


function getReportData({ start = null, end = null } = {}) {
  const inRange = (column) => {
    const parts = [];
    if (start) parts.push(`${column} >= @start`);
    if (end) parts.push(`${column} < @end`);
    return parts.length ? parts.join(' AND ') : '1=1';
  };
  const params = { start, end };
  const cashSales = db.prepare(`SELECT * FROM sales WHERE ${inRange('date')} ORDER BY date ASC, id ASC`).all(params).map(s => ({ ...saleRowToObject(s), saleType: 'paid' }));
  // Credit sales are real revenue at the time the sale is completed, not when
  // cash is collected. Include their item lines so Reports and Dashboard use
  // the same revenue/profit population.
  const creditSales = db.prepare(`
    SELECT i.id, i.product_id, i.product_name, i.quantity,
           i.cost_at_sale AS buying_price, i.selling_price,
           (COALESCE(i.cost_at_sale,0) * i.quantity) AS total_cost,
           (i.selling_price * i.quantity) AS total_revenue,
           ((i.selling_price * i.quantity) - (COALESCE(i.cost_at_sale,0) * i.quantity)) AS profit,
           NULL AS payment_method, NULL AS account_id, NULL AS account_label, NULL AS account_number,
           NULL AS notes, cs.date, NULL AS edited_at, i.batch_breakdown,
           cs.customer_phone, cs.customer_name, 0 AS discount,
           i.product_category, i.product_brand, i.product_unit, i.product_image_uri, i.product_size,
           cs.actor_name
    FROM credit_sale_items i JOIN credit_sales cs ON cs.id=i.credit_sale_id
    WHERE ${inRange('cs.date')} AND cs.status <> 'cancelled'
    ORDER BY cs.date ASC, i.id ASC
  `).all(params).map(s => ({ ...saleRowToObject(s), saleType: 'credit' }));
  const sales = [...cashSales, ...creditSales].sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const expenses = db.prepare(`SELECT * FROM expenditures WHERE ${inRange('date')} ORDER BY date ASC, id ASC`).all(params).map(e => ({ id:e.id, description:e.description, amount:e.amount, type:e.type, date:e.date, accountId:e.account_id || null, accountLabel:e.account_label || null, accountNumber:e.account_number || null }));
  const credits = getCreditSales().filter(cs => {
    if (start && cs.date < start) return false;
    if (end && cs.date > end) return false;
    return true;
  });
  const products = getProducts();
  const taxes = db.prepare(`SELECT id,invoice_id,source_document_id,tax_type,taxable_amount,tax_rate,tax_amount,date FROM tax_ledger WHERE ${inRange('date')} ORDER BY date ASC, id ASC`).all(params).map(t => ({
    id:t.id, invoiceId:t.invoice_id, sourceDocumentId:t.source_document_id, taxType:t.tax_type,
    taxableAmount:t.taxable_amount, taxRate:t.tax_rate, taxAmount:t.tax_amount, date:t.date,
  }));
  return { sales, expenses, credits, products, taxes };
}

function nextInvoiceNumber() {
  return db.prepare('SELECT COALESCE(MAX(invoice_number), 0) + 1 AS n FROM invoices').get().n;
}

function invoiceMeta() {
  const rows = db.prepare("SELECT key,value FROM system_meta WHERE key IN ('shop_id','device_id')").all();
  return Object.fromEntries(rows.map(x => [x.key, x.value]));
}

function invoiceDueDate(now, terms) {
  const days = terms === 'net_15' ? 15 : terms === 'net_30' ? 30 : terms === 'net_60' ? 60 : 0;
  const due = new Date(now); due.setDate(due.getDate() + days); return due.toISOString();
}

function invoiceDetails(details = {}) {
  return {
    company: details.customerCompany?.trim() || null,
    address: details.customerAddress?.trim() || null,
    tin: details.customerTin?.trim() || null,
    email: details.customerEmail?.trim() || null,
    reg: details.customerRegistrationNo?.trim() || null,
    po: details.purchaseOrderNo?.trim() || null,
    notes: details.notes?.trim() || null,
    kind: details.invoiceKind === 'b2b' ? 'b2b' : 'standard',
    terms: details.paymentTerms || 'due_on_receipt',
  };
}

const createCreditInvoiceTx = db.transaction((creditSaleId, details = {}) => {
  const existing = db.prepare('SELECT id FROM invoices WHERE credit_sale_id=?').get(creditSaleId);
  if (existing) return getInvoiceByCreditSaleId(creditSaleId);
  const cs = db.prepare('SELECT * FROM credit_sales WHERE id=?').get(creditSaleId);
  if (!cs) throw new Error('CREDIT_SALE_NOT_FOUND');
  const items = db.prepare('SELECT * FROM credit_sale_items WHERE credit_sale_id=? ORDER BY id').all(creditSaleId);
  const now = new Date().toISOString(), id = genId('inv'), num = nextInvoiceNumber(), d = invoiceDetails(details), m = invoiceMeta();
  db.prepare(`INSERT INTO invoices (id,invoice_number,credit_sale_id,sale_id,invoice_kind,customer_name,customer_phone,customer_company,customer_address,customer_tin,customer_email,customer_registration_no,purchase_order_no,notes,payment_terms,issue_date,due_date,status,total,amount_paid,shop_id,device_id,created_at,updated_at)
    VALUES (@id,@num,@credit,NULL,@kind,@name,@phone,@company,@address,@tin,@email,@reg,@po,@notes,@terms,@issue,@due,'issued',@total,@paid,@shop,@device,@created,@updated)`).run({
      id,num,credit:creditSaleId,kind:d.kind,name:cs.customer_name,phone:cs.customer_phone,company:d.company,address:d.address,tin:d.tin,email:d.email,reg:d.reg,po:d.po,notes:d.notes,terms:d.terms,issue:now,due:invoiceDueDate(now,d.terms),total:cs.total_amount,paid:cs.amount_paid||0,shop:m.shop_id||null,device:m.device_id||null,created:now,updated:now
    });
  const ins = db.prepare(`INSERT INTO invoice_items (id,invoice_id,product_id,product_name,quantity,unit_price,line_total,shop_id,device_id) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const item of items) ins.run(genId('invi'),id,item.product_id,item.product_name,item.quantity,item.selling_price,item.quantity*item.selling_price,m.shop_id||null,m.device_id||null);
  return getInvoiceByCreditSaleId(creditSaleId);
});

const createSaleInvoiceTx = db.transaction((saleId, details = {}) => {
  const existing = db.prepare('SELECT id FROM invoices WHERE sale_id=?').get(saleId);
  if (existing) return getInvoiceBySaleId(saleId);
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(saleId);
  if (!sale) throw new Error('SALE_NOT_FOUND');
  const now = new Date().toISOString(), id = genId('inv'), num = nextInvoiceNumber(), d = invoiceDetails(details), m = invoiceMeta();
  db.prepare(`INSERT INTO invoices (id,invoice_number,credit_sale_id,sale_id,invoice_kind,customer_name,customer_phone,customer_company,customer_address,customer_tin,customer_email,customer_registration_no,purchase_order_no,notes,payment_terms,issue_date,due_date,status,total,amount_paid,shop_id,device_id,created_at,updated_at)
    VALUES (@id,@num,NULL,@sale,@kind,@name,@phone,@company,@address,@tin,@email,@reg,@po,@notes,@terms,@issue,@due,'paid',@total,@paid,@shop,@device,@created,@updated)`).run({
      id,num,sale:saleId,kind:d.kind,name:details.customerName?.trim()||sale.customer_name||null,phone:details.customerPhone?.trim()||sale.customer_phone||null,company:d.company,address:d.address,tin:d.tin,email:d.email,reg:d.reg,po:d.po,notes:d.notes,terms:d.terms,issue:now,due:invoiceDueDate(now,d.terms),total:sale.total_revenue,paid:sale.total_revenue,shop:m.shop_id||null,device:m.device_id||null,created:now,updated:now
    });
  db.prepare(`INSERT INTO invoice_items (id,invoice_id,product_id,product_name,quantity,unit_price,line_total,shop_id,device_id) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(genId('invi'),id,sale.product_id,sale.product_name,sale.quantity,sale.selling_price,sale.total_revenue,m.shop_id||null,m.device_id||null);
  return getInvoiceBySaleId(saleId);
});

function assembleInvoice(row) {
  if (!row) return null;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id').all(row.id).map(i=>({productId:i.product_id,productName:i.product_name,quantity:i.quantity,sellingPrice:i.unit_price,lineTotal:i.line_total}));
  const balance=Math.max(0,(row.total||0)-(row.amount_paid||0));
  const payments=row.credit_sale_id?db.prepare('SELECT id,amount,payment_method,account_id,account_label,account_number,date FROM credit_sale_payments WHERE credit_sale_id=? ORDER BY date ASC,id ASC').all(row.credit_sale_id).map(p=>({id:p.id,amount:p.amount,paymentMethod:p.payment_method,accountId:p.account_id,accountLabel:p.account_label,accountNumber:p.account_number,date:p.date})):[];
  const status=balance<=0?'paid':(row.due_date && new Date(row.due_date).getTime()<Date.now()?'overdue':((row.amount_paid||0)>0?'partial':row.status));
  return { id:row.id, invoiceNumber:row.invoice_number, invoiceKind:row.invoice_kind||'standard', creditSaleId:row.credit_sale_id, saleId:row.sale_id, sourceDocumentId:row.source_document_id||null, customerName:row.customer_name, customerPhone:row.customer_phone, customerCompany:row.customer_company, customerAddress:row.customer_address, customerTin:row.customer_tin, customerEmail:row.customer_email, customerRegistrationNo:row.customer_registration_no, purchaseOrderNo:row.purchase_order_no, notes:row.notes, paymentTerms:row.payment_terms, date:row.issue_date, dueDate:row.due_date, status, subtotal:Number(row.subtotal||row.total||0), discount:Number(row.discount||0), tax:Number(row.tax||0), taxRate:Number(row.tax_rate||0), total:row.total, amountPaid:row.amount_paid||0, balance, payments, items };
}
function createInvoice(creditSaleId, details) { return createCreditInvoiceTx(creditSaleId, details); }
function createSaleInvoice(saleId, details) { return createSaleInvoiceTx(saleId, details); }
function getInvoiceByCreditSaleId(id) { return assembleInvoice(db.prepare('SELECT * FROM invoices WHERE credit_sale_id=?').get(id)); }
function getInvoiceBySaleId(id) { return assembleInvoice(db.prepare('SELECT * FROM invoices WHERE sale_id=?').get(id)); }


function nextCommercialDocumentNumber(type) {
  const row = db.prepare('SELECT COALESCE(MAX(document_number),0)+1 AS n FROM commercial_documents WHERE document_type=?').get(type);
  return row.n;
}
function assembleCommercialDocument(row) {
  if (!row) return null;
  const items = db.prepare('SELECT * FROM commercial_document_items WHERE document_id=? ORDER BY id').all(row.id).map(i => ({ id:i.id, productId:i.product_id, productName:i.product_name, quantity:i.quantity, unitPrice:i.unit_price, lineTotal:i.line_total }));
  return { id:row.id, documentType:row.document_type, documentNumber:row.document_number, customerCompany:row.customer_company, contactPerson:row.contact_person, customerPhone:row.customer_phone, customerEmail:row.customer_email, customerAddress:row.customer_address, customerTin:row.customer_tin, customerRegistrationNo:row.customer_registration_no, purchaseOrderNo:row.purchase_order_no, issueDate:row.issue_date, validUntil:row.valid_until, paymentTerms:row.payment_terms, notes:row.notes, status:row.status, subtotal:row.subtotal, discount:row.discount, tax:row.tax, total:row.total, sourceDocumentId:row.source_document_id, convertedCreditSaleId:row.converted_credit_sale_id||null, convertedInvoiceId:row.converted_invoice_id||null, convertedAt:row.converted_at||null, convertedSaleIds:row.converted_sale_ids?JSON.parse(row.converted_sale_ids):[], items };
}
const createCommercialDocumentTx = db.transaction((args={}) => {
  const type = args.documentType === 'proforma' ? 'proforma' : 'quotation';
  if (!String(args.customerCompany||'').trim()) throw new Error('COMPANY_REQUIRED');
  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) throw new Error('DOCUMENT_ITEMS_REQUIRED');
  const clean = items.map(x => ({ productId:x.productId||null, productName:String(x.productName||'').trim(), quantity:Number(x.quantity), unitPrice:Number(x.unitPrice) }));
  if (clean.some(x => !x.productName || !(x.quantity>0) || x.unitPrice<0 || !Number.isFinite(x.unitPrice))) throw new Error('INVALID_DOCUMENT_ITEM');
  const subtotal = clean.reduce((a,x)=>a+x.quantity*x.unitPrice,0);
  const discount = Math.max(0, Number(args.discount)||0); const taxRate=Math.max(0,Number(args.taxRate)||0);
  const taxable=Math.max(0,subtotal-discount); const tax=taxable*taxRate/100; const total=taxable+tax;
  const now=new Date().toISOString(), id=genId(type==='quotation'?'quo':'pro'), num=nextCommercialDocumentNumber(type), m=invoiceMeta();
  db.prepare(`INSERT INTO commercial_documents (id,document_type,document_number,customer_company,contact_person,customer_phone,customer_email,customer_address,customer_tin,customer_registration_no,purchase_order_no,issue_date,valid_until,payment_terms,notes,status,subtotal,discount,tax,total,source_document_id,shop_id,device_id,created_at,updated_at) VALUES (@id,@type,@num,@company,@contact,@phone,@email,@address,@tin,@reg,@po,@issue,@valid,@terms,@notes,'issued',@subtotal,@discount,@tax,@total,@source,@shop,@device,@created,@updated)`).run({id,type,num,company:String(args.customerCompany).trim(),contact:args.contactPerson?.trim()||null,phone:args.customerPhone?.trim()||null,email:args.customerEmail?.trim()||null,address:args.customerAddress?.trim()||null,tin:args.customerTin?.trim()||null,reg:args.customerRegistrationNo?.trim()||null,po:args.purchaseOrderNo?.trim()||null,issue:now,valid:args.validUntil||null,terms:args.paymentTerms?.trim()||null,notes:args.notes?.trim()||null,subtotal,discount,tax,total,source:args.sourceDocumentId||null,shop:m.shop_id||null,device:m.device_id||null,created:now,updated:now});
  const ins=db.prepare('INSERT INTO commercial_document_items (id,document_id,product_id,product_name,quantity,unit_price,line_total,shop_id,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const x of clean) ins.run(genId('cdi'),id,x.productId,x.productName,x.quantity,x.unitPrice,x.quantity*x.unitPrice,m.shop_id||null,m.device_id||null);
  if (args.sourceDocumentId) db.prepare("UPDATE commercial_documents SET status='converted', updated_at=? WHERE id=?").run(now,args.sourceDocumentId);
  return assembleCommercialDocument(db.prepare('SELECT * FROM commercial_documents WHERE id=?').get(id));
});
function createCommercialDocument(args){ return createCommercialDocumentTx(args); }
function listCommercialDocuments(args={}) { const type=args.documentType; const rows=type?db.prepare('SELECT * FROM commercial_documents WHERE document_type=? ORDER BY issue_date DESC,document_number DESC LIMIT 500').all(type):db.prepare('SELECT * FROM commercial_documents ORDER BY issue_date DESC,document_number DESC LIMIT 500').all(); return rows.map(assembleCommercialDocument); }
function getCommercialDocument(id){ return assembleCommercialDocument(db.prepare('SELECT * FROM commercial_documents WHERE id=?').get(id)); }
function convertQuotationToProforma(id){ const q=getCommercialDocument(id); if(!q||q.documentType!=='quotation') throw new Error('QUOTATION_NOT_FOUND'); return createCommercialDocument({...q, documentType:'proforma', sourceDocumentId:q.id, items:q.items.map(x=>({productId:x.productId,productName:x.productName,quantity:x.quantity,unitPrice:x.unitPrice})), discount:q.discount, taxRate:q.subtotal>q.discount ? (q.tax/(q.subtotal-q.discount))*100 : 0}); }

function listInvoices(args={}) {
  const limit=Math.min(500,Math.max(1,Number(args.limit)||200));
  return db.prepare('SELECT * FROM invoices ORDER BY issue_date DESC, invoice_number DESC LIMIT ?').all(limit).map(assembleInvoice);
}


function documentTaxRate(doc) {
  const taxable = Math.max(0, Number(doc.subtotal||0) - Number(doc.discount||0));
  return taxable > 0 ? (Number(doc.tax||0) / taxable) * 100 : 0;
}
function allocateDocumentDiscount(doc) {
  const subtotal=Number(doc.subtotal||0), discount=Number(doc.discount||0);
  let remaining=discount;
  return doc.items.map((x,index)=>{
    const gross=Number(x.quantity)*Number(x.unitPrice);
    const share=index===doc.items.length-1 ? remaining : (subtotal>0 ? discount*(gross/subtotal) : 0);
    remaining-=share;
    return {...x,lineDiscount:Math.max(0,Math.min(gross,share))};
  });
}
function applyDocumentFinancialsToInvoice(invoiceId, doc) {
  const rate=documentTaxRate(doc), now=new Date().toISOString(), m=invoiceMeta();
  db.prepare('UPDATE invoices SET subtotal=?,discount=?,tax=?,tax_rate=?,total=?,updated_at=? WHERE id=?')
    .run(doc.subtotal,doc.discount,doc.tax,rate,doc.total,now,invoiceId);
  db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(invoiceId);
  const ins=db.prepare('INSERT INTO invoice_items (id,invoice_id,product_id,product_name,quantity,unit_price,line_total,shop_id,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  for(const x of doc.items) ins.run(genId('invi'),invoiceId,x.productId,x.productName,x.quantity,x.unitPrice,x.lineTotal,m.shop_id||null,m.device_id||null);
  if(Number(doc.tax||0)>0){
    db.prepare(`INSERT OR REPLACE INTO tax_ledger (id,invoice_id,source_document_id,tax_type,taxable_amount,tax_rate,tax_amount,date,shop_id,device_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(genId('tax'),invoiceId,doc.id,'sales_tax',Math.max(0,doc.subtotal-doc.discount),rate,doc.tax,now,m.shop_id||null,m.device_id||null,now);
  }
}
function getTaxSummary(args={}) {
  const from=args.from||'0000-01-01T00:00:00.000Z', to=args.to||'9999-12-31T23:59:59.999Z';
  const row=db.prepare('SELECT COALESCE(SUM(taxable_amount),0) taxable,COALESCE(SUM(tax_amount),0) tax,COUNT(*) transactions FROM tax_ledger WHERE date>=? AND date<=?').get(from,to);
  return {taxableAmount:row.taxable,taxAmount:row.tax,transactions:row.transactions};
}

const convertProformaToCreditSaleTx = db.transaction((documentId, options={}) => {
  const doc = getCommercialDocument(documentId);
  if (!doc) throw new Error('DOCUMENT_NOT_FOUND');
  if (doc.documentType !== 'proforma') throw new Error('PROFORMA_REQUIRED');
  if (doc.status === 'converted') {
    const invoice = doc.convertedInvoiceId ? assembleInvoice(db.prepare('SELECT * FROM invoices WHERE id=?').get(doc.convertedInvoiceId)) : null;
    return { document:doc, creditSale:doc.convertedCreditSaleId ? getCreditSales().find(x=>x.id===doc.convertedCreditSaleId)||null : null, invoice, replayed:true };
  }
  if (!doc.items.length || doc.items.some(x=>!x.productId)) throw new Error('PROFORMA_STOCK_PRODUCTS_REQUIRED');
  const operationId=String(options.operationId||`proforma_${documentId}`);
  const allocated=allocateDocumentDiscount(doc);
  const result=completeCreditSale({
    operationId,
    cartItems:allocated.map(x=>({productId:x.productId,productName:x.productName,quantity:x.quantity,sellingPrice:(x.lineTotal-x.lineDiscount)/x.quantity,discount:0})),
    customerName:doc.contactPerson||doc.customerCompany,
    customerPhone:doc.customerPhone||'',
    actorName:options.actorName||null,
  });
  if (!result.success) throw new Error(result.error||'PROFORMA_CONVERSION_FAILED');
  const cs=result.creditSale;
  if (Number(doc.tax||0)>0) { db.prepare('UPDATE credit_sales SET total_amount=?,updated_at=?,version=version+1 WHERE id=?').run(doc.total,new Date().toISOString(),cs.id); cs.totalAmount=doc.total; }
  const invoice=createCreditInvoiceTx(cs.id,{
    invoiceKind:'b2b',customerCompany:doc.customerCompany,customerAddress:doc.customerAddress,customerTin:doc.customerTin,
    customerEmail:doc.customerEmail,customerRegistrationNo:doc.customerRegistrationNo,purchaseOrderNo:doc.purchaseOrderNo,
    customerName:doc.contactPerson||doc.customerCompany,customerPhone:doc.customerPhone||'',paymentTerms:options.paymentTerms||'due_on_receipt',notes:doc.notes||''
  });
  db.prepare('UPDATE invoices SET source_document_id=?, updated_at=? WHERE id=?').run(documentId,new Date().toISOString(),invoice.id);
  applyDocumentFinancialsToInvoice(invoice.id,doc);
  const now=new Date().toISOString();
  db.prepare("UPDATE commercial_documents SET status='converted',converted_credit_sale_id=?,converted_invoice_id=?,converted_at=?,updated_at=? WHERE id=?")
    .run(cs.id,invoice.id,now,now,documentId);
  return {document:getCommercialDocument(documentId),creditSale:cs,invoice:assembleInvoice(db.prepare('SELECT * FROM invoices WHERE id=?').get(invoice.id)),replayed:false};
});
function convertProformaToCreditSale(documentId, options={}) { return convertProformaToCreditSaleTx(documentId, options); }

const convertProformaToSaleTx = db.transaction((documentId, options={}) => {
  const doc=getCommercialDocument(documentId);
  if(!doc || doc.documentType!=='proforma') throw new Error('PROFORMA_NOT_FOUND');
  if(doc.convertedInvoiceId){ const invoice=assembleInvoice(db.prepare('SELECT * FROM invoices WHERE id=?').get(doc.convertedInvoiceId)); return {document:doc,sales:doc.convertedSaleIds.map(id=>db.prepare('SELECT * FROM sales WHERE id=?').get(id)).filter(Boolean),invoice,replayed:true}; }
  if(doc.items.some(x=>!x.productId)) throw new Error('PROFORMA_STOCK_PRODUCTS_REQUIRED');
  const op=options.operationId||`proforma_cash_${documentId}`;
  const allocated=allocateDocumentDiscount(doc);
  const result=completeCartSale(allocated.map(x=>({productId:x.productId,productName:x.productName,quantity:x.quantity,sellingPrice:x.unitPrice,discount:x.lineDiscount})),{operationId:op,paymentMethod:options.paymentMethod||'cash',accountId:options.accountId||null,accountLabel:options.accountLabel||'',accountNumber:options.accountNumber||'',customerName:doc.contactPerson||doc.customerCompany,customerPhone:doc.customerPhone||null,actorName:options.actorName||null});
  if(!result.success) throw new Error(result.error||'SALE_CONVERSION_FAILED');
  const sales=result.sales||[]; const now=new Date().toISOString(), id=genId('inv'), num=nextInvoiceNumber(), m=invoiceMeta();
  db.prepare(`INSERT INTO invoices (id,invoice_number,credit_sale_id,sale_id,invoice_kind,customer_name,customer_phone,customer_company,customer_address,customer_tin,customer_email,customer_registration_no,purchase_order_no,notes,payment_terms,issue_date,due_date,status,total,amount_paid,shop_id,device_id,created_at,updated_at,source_document_id) VALUES (@id,@num,NULL,NULL,'b2b',@name,@phone,@company,@address,@tin,@email,@reg,@po,@notes,@terms,@issue,@due,'paid',@total,@total,@shop,@device,@created,@updated,@source)`).run({id,num,name:doc.contactPerson||null,phone:doc.customerPhone||null,company:doc.customerCompany,address:doc.customerAddress||null,tin:doc.customerTin||null,email:doc.customerEmail||null,reg:doc.customerRegistrationNo||null,po:doc.purchaseOrderNo||null,notes:doc.notes||null,terms:doc.paymentTerms||null,issue:now,due:now,total:doc.total,shop:m.shop_id||null,device:m.device_id||null,created:now,updated:now,source:documentId});
  const ins=db.prepare('INSERT INTO invoice_items (id,invoice_id,product_id,product_name,quantity,unit_price,line_total,shop_id,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  for(const x of doc.items) ins.run(genId('invi'),id,x.productId,x.productName,x.quantity,x.unitPrice,x.lineTotal,m.shop_id||null,m.device_id||null);
  applyDocumentFinancialsToInvoice(id,doc);
  const ids=sales.map(x=>x.id); db.prepare("UPDATE commercial_documents SET status='converted',converted_sale_ids=?,converted_invoice_id=?,converted_at=?,updated_at=? WHERE id=?").run(JSON.stringify(ids),id,now,now,documentId);
  return {document:getCommercialDocument(documentId),sales,invoice:assembleInvoice(db.prepare('SELECT * FROM invoices WHERE id=?').get(id)),replayed:false};
});
function convertProformaToSale(id,options){ return convertProformaToSaleTx(id,options||{}); }

function updateCommercialDocumentStatus(id,status){ const allowed=new Set(['draft','issued','accepted','rejected','expired','converted']); if(!allowed.has(status)) throw new Error('INVALID_DOCUMENT_STATUS'); db.prepare('UPDATE commercial_documents SET status=?,updated_at=? WHERE id=?').run(status,new Date().toISOString(),id); return getCommercialDocument(id); }

function getExpenditures() {
  return db
    .prepare("SELECT * FROM expenditures")
    .all()
    .map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      type: e.type,
      date: e.date,
      accountId: e.account_id || null, accountLabel: e.account_label || '', accountNumber: e.account_number || '',
    }));
}

const saveExpenditures = db.transaction((expenditures) => {
  db.prepare("DELETE FROM expenditures").run();
  const insert = db.prepare(`
    INSERT INTO expenditures (id, description, amount, type, date)
    VALUES (@id, @description, @amount, @type, @date)
  `);
  for (const e of expenditures) {
    insert.run({
      id: e.id,
      description: e.description,
      amount: e.amount,
      type: e.type ?? null,
      date: e.date,
    });
  }
});

function addExpenditure(e) {
  try { return { success: true, expenditure: expenseDomain.addTx(e || {}) }; }
  catch (err) { if (err.code === "IDEMPOTENCY_CONFLICT") return { success:false,error:"IDEMPOTENCY_CONFLICT" }; return { success:false,error:err.message }; }
}

function deleteExpenditure(idOrArgs) {
  const args = typeof idOrArgs === "object" ? idOrArgs : { id:idOrArgs };
  try { return { success: true, ...expenseDomain.deleteTx(args) }; }
  catch (err) { return { success:false,error:err.message }; }
}

function getSuppliers() {
  const suppliers = db.prepare("SELECT * FROM suppliers").all();
  const payments = db
    .prepare("SELECT * FROM supplier_payments ORDER BY date ASC")
    .all();
  const paymentsBySupplier = {};
  for (const p of payments) {
    (paymentsBySupplier[p.supplier_id] ||= []).push({
      amount: p.amount,
      paymentMethod: p.payment_method,
      date: p.date,
    });
  }
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    totalSupplied: s.total_supplied,
    totalPaid: s.total_paid,
    payments: paymentsBySupplier[s.id] || [],
  }));
}

const saveSuppliers = db.transaction((suppliers) => {
  db.prepare("DELETE FROM supplier_payments").run();
  db.prepare("DELETE FROM suppliers").run();

  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, phone, total_supplied, total_paid)
    VALUES (@id, @name, @phone, @totalSupplied, @totalPaid)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO supplier_payments (id, supplier_id, amount, payment_method, date)
    VALUES (@id, @supplierId, @amount, @paymentMethod, @date)
  `);
  const genId = (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  for (const s of suppliers) {
    insertSupplier.run({
      id: s.id,
      name: s.name,
      phone: s.phone ?? null,
      totalSupplied: s.totalSupplied || 0,
      totalPaid: s.totalPaid || 0,
    });
    for (const pmt of s.payments || []) {
      insertPayment.run({
        id: genId("sp"),
        supplierId: s.id,
        amount: pmt.amount,
        paymentMethod: pmt.paymentMethod ?? null,
        date: pmt.date,
      });
    }
  }
});

function getStaff() {
  return db
    .prepare("SELECT * FROM staff")
    .all()
    .map((s) => ({
      id: s.id,
      name: s.name,
      pin: s.pin,
      permissions: JSON.parse(s.permissions || "{}"),
    }));
}

const saveStaff = db.transaction((staff) => {
  db.prepare("DELETE FROM staff").run();
  const insert = db.prepare(
    `INSERT INTO staff (id, name, pin, permissions) VALUES (@id, @name, @pin, @permissions)`,
  );
  for (const s of staff) {
    insert.run({
      id: s.id,
      name: s.name,
      pin: s.pin,
      permissions: JSON.stringify(s.permissions || {}),
    });
  }
});

// Granular staff operations — simple CRUD with a PIN-uniqueness check,
// no batch/FIFO complexity like the sales-side functions. The
// self-exclusion case (updating a staff member while keeping their own
// existing PIN) was tested directly, since a naive "does this PIN
// already exist" check would wrongly reject a no-op edit.
function addStaff({ name, pin, permissions, actorName }) {
  if (!name || !name.trim())
    return { success: false, error: "Weka jina la mfanyakazi" };
  if (!pin || pin.length < 4)
    return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };

  const settings = getSettings();
  if (settings.ownerPin && pin === settings.ownerPin)
    return {
      success: false,
      error: "PIN hii inatumika na mmiliki — chagua PIN tofauti",
    };

  const existing = db
    .prepare("SELECT COUNT(*) as c FROM staff WHERE pin = ?")
    .get(pin);
  if (existing.c > 0)
    return {
      success: false,
      error: "PIN hii tayari inatumika na mfanyakazi mwingine",
    };

  const id = genId("staff");
  db.prepare(
    "INSERT INTO staff (id, name, pin, permissions) VALUES (?, ?, ?, ?)",
  ).run(id, name.trim(), pin, JSON.stringify(permissions || {}));

  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'added a staff member', ?, ?, ?)`,
  ).run(genId("al"), name.trim(), actorName || null, new Date().toISOString());

  return {
    success: true,
    staff: { id, name: name.trim(), pin, permissions: permissions || {} },
  };
}

function updateStaff(staffId, { name, pin, permissions, actorName }) {
  if (!name || !name.trim())
    return { success: false, error: "Weka jina la mfanyakazi" };
  if (!pin || pin.length < 4)
    return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };

  const settings = getSettings();
  if (settings.ownerPin && pin === settings.ownerPin)
    return {
      success: false,
      error: "PIN hii inatumika na mmiliki — chagua PIN tofauti",
    };

  const existing = db
    .prepare("SELECT COUNT(*) as c FROM staff WHERE pin = ? AND id != ?")
    .get(pin, staffId);
  if (existing.c > 0)
    return {
      success: false,
      error: "PIN hii tayari inatumika na mfanyakazi mwingine",
    };

  db.prepare(
    "UPDATE staff SET name = ?, pin = ?, permissions = ? WHERE id = ?",
  ).run(name.trim(), pin, JSON.stringify(permissions || {}), staffId);

  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'updated a staff member', ?, ?, ?)`,
  ).run(genId("al"), name.trim(), actorName || null, new Date().toISOString());

  return { success: true };
}

function deleteStaff(staffId, actorName) {
  const removed = db.prepare("SELECT * FROM staff WHERE id = ?").get(staffId);
  db.prepare("DELETE FROM staff WHERE id = ?").run(staffId);
  if (removed) {
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'removed a staff member', ?, ?, ?)`,
    ).run(
      genId("al"),
      removed.name,
      actorName || null,
      new Date().toISOString(),
    );
  }
  return { success: true };
}

function identifyStaffByPin(pin) {
  const row = db.prepare("SELECT * FROM staff WHERE pin = ?").get(pin);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    isOwner: false,
    permissions: JSON.parse(row.permissions || "{}"),
  };
}

// Granular supplier operations. recordPayment's "can't pay more than
// owed" check reads the current balance and writes the update in the
// same transaction — the array-based version read the whole suppliers
// list, checked in JS, then saved back separately, leaving a real gap
// where two concurrent payments could each pass the check against the
// same stale balance and together overpay past what was actually owed.
function addSupplier({ name, phone }) {
  if (!name || !name.trim())
    return { success: false, error: "Weka jina la msambazaji" };
  const id = genId("sup");
  db.prepare(
    "INSERT INTO suppliers (id, name, phone, total_supplied, total_paid) VALUES (?, ?, ?, 0, 0)",
  ).run(id, name.trim(), (phone || "").trim());
  return {
    success: true,
    supplier: {
      id,
      name: name.trim(),
      phone: (phone || "").trim(),
      totalSupplied: 0,
      totalPaid: 0,
      payments: [],
    },
  };
}

function deleteSupplier(supplierId) {
  db.prepare("DELETE FROM suppliers WHERE id = ?").run(supplierId); // cascades to supplier_payments
  return { success: true };
}

function recordSupply(supplierId, amount) {
  db.prepare(
    "UPDATE suppliers SET total_supplied = total_supplied + ? WHERE id = ?",
  ).run(amount, supplierId);
  return { success: true };
}

const recordSupplierPaymentTx = db.transaction(
  (supplierId, amount, paymentMethod) => {
    const supplier = db
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(supplierId);
    if (!supplier) throw new CartValidationError("Msambazaji hapatikani");

    const owed = supplier.total_supplied - supplier.total_paid;
    if (amount > owed)
      throw new CartValidationError(
        `Kiasi kinazidi deni lililobaki (${Math.round(owed)})`,
      );

    db.prepare(
      "UPDATE suppliers SET total_paid = total_paid + ? WHERE id = ?",
    ).run(amount, supplierId);
    const date = new Date().toISOString();
    db.prepare(
      "INSERT INTO supplier_payments (id, supplier_id, amount, payment_method, date) VALUES (?, ?, ?, ?, ?)",
    ).run(genId("sp"), supplierId, amount, paymentMethod || "", date);
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'paid a supplier', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${supplier.name} — TZS ${Math.round(amount).toLocaleString("en-US")}`,
      date,
    );
  },
);

function recordSupplierPayment(supplierId, amount, paymentMethod) {
  if (!amount || amount <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  try {
    recordSupplierPaymentTx(supplierId, amount, paymentMethod);
    return { success: true };
  } catch (err) {
    if (err instanceof CartValidationError)
      return { success: false, error: err.message };
    throw err;
  }
}

// Restocking creates a genuinely new batch row rather than blending into
// one running average — same reasoning as the old batchService.addBatch,
// now as real SQL. This is what lets a later sale know the real,
// specific cost of the units it consumes (FIFO), not an average that
// drifts from reality as prices change over time.
function recomputeProductSummary(productId) {
  return inventory.recomputeProductSummary(productId);
}

const addStockTx = db.transaction(
  (
    productId,
    quantity,
    buyingPrice,
    supplierId,
    supplierName,
    paymentMethod,
    accountId,
    accountLabel,
    accountNumber,
  ) => {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(productId);
    if (!product) throw new CartValidationError("Bidhaa haipatikani");

    const date = new Date().toISOString();
    db.prepare(
      `
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    ).run(
      genId("b"),
      productId,
      quantity,
      quantity,
      buyingPrice,
      date,
      supplierId || null,
      supplierName || null,
      paymentMethod || null,
      accountId || null,
      accountLabel || null,
      accountNumber || null,
    );

    recomputeProductSummary(productId);

    // Show exactly which account paid for it, when one was picked — not
    // just "added stock", the same specificity accountLabel gives sales.
    const paidViaSuffix = accountLabel ? ` — ${accountLabel}` : "";
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'added stock', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${product.name} +${quantity} @ TZS ${Math.round(buyingPrice).toLocaleString("en-US")}${paidViaSuffix}`,
      date,
    );
  },
);

function addStock(args) {
  try { return { success:true, result:purchaseDomain.addTx(args || {}) }; }
  catch (err) {
    const map={INVALID_PURCHASE_QUANTITY:"Weka kiasi sahihi",INVALID_PURCHASE_PRICE:"Bei ya kununua haiwezi kuwa hasi",PRODUCT_NOT_FOUND:"Bidhaa haipatikani",IDEMPOTENCY_CONFLICT:"Ombi hili limetumika tayari kwa taarifa tofauti"};
    return { success:false,error:map[err.code || err.message] || err.message };
  }
}

// Same all-or-nothing guarantee as a cash cart sale — a restock order
// covering several products is one business event (one delivery, one
// supplier trip), so it should commit completely or not at all. Tested
// directly: one valid product alongside one with a negative price
// correctly rolls back the valid one too, leaving stock exactly as it
// was before the attempt.
const completeRestockCartTx = db.transaction((cartItems, meta) => {
  for (const item of cartItems) {
    if (!item.quantity || item.quantity <= 0) {
      throw new CartValidationError(`${item.productName}: weka kiasi sahihi`);
    }
    if (item.buyingPrice < 0) {
      throw new CartValidationError(
        `${item.productName}: bei ya kununua haiwezi kuwa hasi`,
      );
    }
  }

  const date = new Date().toISOString();
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of cartItems) {
    insertBatch.run(
      genId("b"),
      item.productId,
      item.quantity,
      item.quantity,
      item.buyingPrice,
      date,
      meta.supplierId || null,
      meta.supplierName || null,
      meta.paymentMethod || null,
      meta.accountId || null,
      meta.accountLabel || null,
      meta.accountNumber || null,
    );
    recomputeProductSummary(item.productId);
  }

  const paidViaSuffix = meta.accountLabel ? ` — ${meta.accountLabel}` : "";
  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'restocked multiple products', ?, NULL, ?)`,
  ).run(genId("al"), `${cartItems.length} bidhaa${paidViaSuffix}`, date);
});

function completeRestockCart(cartItems, meta = {}) {
  try { return { success:true, batches:purchaseDomain.cartTx(cartItems || [], meta || {}) }; }
  catch (err) {
    const map={EMPTY_PURCHASE_CART:"Hakuna bidhaa kwenye kikapu",INVALID_PURCHASE_QUANTITY:"Weka kiasi sahihi",INVALID_PURCHASE_PRICE:"Bei ya kununua haiwezi kuwa hasi",PRODUCT_NOT_FOUND:"Bidhaa haipatikani",IDEMPOTENCY_CONFLICT:"Ombi hili limetumika tayari kwa taarifa tofauti"};
    return { success:false,error:map[err.code || err.message] || err.message };
  }
}

// Recreates stock exactly as it was actually consumed — one real batch
// per breakdown entry at its real price — rather than one batch blended
// to an average. Falls back to a single averaged batch only for sales
// made before batch_breakdown existed, since those never recorded the
// detail needed to do better.
function restoreBatchesFromBreakdown(
  productId,
  breakdown,
  totalQuantity,
  fallbackBuyingPrice,
  fallbackDate,
) {
  return inventory.restoreConsumption({
    productId,
    breakdown,
    totalQuantity,
    fallbackBuyingPrice,
    fallbackDate,
    idFactory: genId,
  });
}

// FIFO consumption as its own reusable piece — same logic completeSaleTx
// uses, extracted here so editSale's "re-consume after restoring" step
// doesn't duplicate it. Throws on insufficient stock so the caller's
// transaction rolls back the restore too, not just the failed
// consumption — an edit either fully succeeds or nothing changes at all.
function consumeStockForEdit(productId, quantity) {
  return inventory.consumeFIFO(productId, quantity);
}

// Editing a sale isn't a field update — the stock it consumed already
// left the shelf. The correct sequence: restore what the ORIGINAL sale
// took (as real batches, at their real prices), then re-consume for the
// NEW quantity from that restored state. Both steps run in one
// transaction — tested directly that editing to an impossible quantity
// rolls back the restore too, not just the failed re-consumption,
// leaving stock exactly as it was before the edit was attempted.
const editSaleTx = db.transaction(
  (saleId, newQuantity, newSellingPrice, notes, actorName, reason) => {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    if (!sale) throw new CartValidationError("SALE_NOT_FOUND");

    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(sale.product_id);
    if (!product) throw new CartValidationError("PRODUCT_NOT_FOUND");

    // Legacy sales recorded before buying_price was tracked won't have
    // one stored — derive a reasonable one from what's already on the
    // record rather than losing the restore entirely.
    const originalBuyingPrice =
      sale.buying_price ??
      (sale.quantity > 0
        ? sale.selling_price - (sale.profit || 0) / sale.quantity
        : product.buying_price);
    const breakdown = sale.batch_breakdown
      ? JSON.parse(sale.batch_breakdown)
      : null;
    const restoreDate = new Date().toISOString();

    restoreBatchesFromBreakdown(
      sale.product_id,
      breakdown,
      sale.quantity,
      originalBuyingPrice,
      restoreDate,
    );

    let consumption;
    try {
      consumption = consumeStockForEdit(sale.product_id, newQuantity);
    } catch (err) {
      if (
        err instanceof CartValidationError &&
        err.message === "INSUFFICIENT_STOCK"
      ) {
        const currentStock = db
          .prepare("SELECT stock FROM products WHERE id = ?")
          .get(sale.product_id).stock;
        throw new CartValidationError(
          `Stoo haitoshi kwa kiasi kipya — ${currentStock} pekee zingekuwepo`,
        );
      }
      throw err;
    }

    const totalRevenue = newSellingPrice * newQuantity;
    const profit = totalRevenue - consumption.totalCost;
    const editedAt = new Date().toISOString();

    db.prepare(
      `
    UPDATE sales SET quantity = ?, buying_price = ?, selling_price = ?, total_cost = ?, total_revenue = ?,
      profit = ?, notes = ?, edited_at = ?, batch_breakdown = ?
    WHERE id = ?
  `,
    ).run(
      newQuantity,
      consumption.effectiveBuyingPrice,
      newSellingPrice,
      consumption.totalCost,
      totalRevenue,
      profit,
      notes || "",
      editedAt,
      JSON.stringify(consumption.breakdown),
      saleId,
    );

    // Only mention fields that actually changed - editing just the price
    // shouldn't produce a log entry that also claims the quantity
    // changed when it didn't.
    const changes = [];
    if (sale.quantity !== newQuantity) {
      changes.push(`kiasi ${sale.quantity} → ${newQuantity}`);
    }
    if (sale.selling_price !== newSellingPrice) {
      changes.push(
        `bei TZS ${Math.round(sale.selling_price).toLocaleString("en-US")} → TZS ${Math.round(newSellingPrice).toLocaleString("en-US")}`,
      );
    }
    const changeSummary = changes.length
      ? changes.join(", ")
      : "hakuna mabadiliko ya thamani";
    const details = `${product.name}: ${changeSummary}${reason ? ` | Sababu: ${reason}` : ""}`;

    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'edited a sale', ?, ?, ?)`,
    ).run(genId("al"), details, actorName || null, editedAt);

    return db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
  },
);

function editSale(
  saleId,
  {
    quantity: newQuantity,
    sellingPrice: newSellingPrice,
    notes,
    actorName,
    reason,
  },
) {
  if (!newQuantity || newQuantity <= 0)
    return { success: false, error: "Weka kiasi sahihi" };
  if (!newSellingPrice || newSellingPrice <= 0)
    return { success: false, error: "Weka bei sahihi ya kuuza" };

  try {
    const row = editSaleTx(
      saleId,
      newQuantity,
      newSellingPrice,
      notes,
      actorName,
      reason,
    );
    return {
      success: true,
      sale: {
        id: row.id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: row.quantity,
        buyingPrice: row.buying_price,
        sellingPrice: row.selling_price,
        totalCost: row.total_cost,
        totalRevenue: row.total_revenue,
        profit: row.profit,
        notes: row.notes,
        editedAt: row.edited_at,
        batchBreakdown: row.batch_breakdown
          ? JSON.parse(row.batch_breakdown)
          : null,
      },
    };
  } catch (err) {
    if (err instanceof CartValidationError) {
      if (err.message === "SALE_NOT_FOUND")
        return { success: false, error: "Muuzo haupatikani" };
      if (err.message === "PRODUCT_NOT_FOUND")
        return { success: false, error: "Bidhaa haipatikani tena" };
      return { success: false, error: err.message };
    }
    throw err;
  }
}

// Simpler than editing — no new quantity to re-consume, just a straight
// restore of what the sale took, then remove the record.
const deleteSaleTx = db.transaction((saleId, actorName, reason) => {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
  if (!sale) throw new CartValidationError("SALE_NOT_FOUND");

  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(sale.product_id);
  if (product) {
    const originalBuyingPrice =
      sale.buying_price ??
      (sale.quantity > 0
        ? sale.selling_price - (sale.profit || 0) / sale.quantity
        : product.buying_price);
    const breakdown = sale.batch_breakdown
      ? JSON.parse(sale.batch_breakdown)
      : null;
    restoreBatchesFromBreakdown(
      sale.product_id,
      breakdown,
      sale.quantity,
      originalBuyingPrice,
      new Date().toISOString(),
    );
  }
  // If the product itself was deleted since this sale happened, there's
  // nothing to restore stock to — the sale record still gets removed.

  if (sale.account_id && Number(sale.total_revenue) > 0) {
    db.prepare(`INSERT OR IGNORE INTO account_ledger(id,account_id,account_label,account_number,direction,amount,entry_type,reference_type,reference_id,description,date,created_at)
      VALUES (?,?,?,?,'out',?,'sale_reversal','sale',?,?,?,?)`).run(genId("alg"),sale.account_id,sale.account_label||'',sale.account_number||'',Number(sale.total_revenue),sale.id,`Reversal: ${sale.product_name}`,new Date().toISOString(),new Date().toISOString());
  }
  db.prepare("DELETE FROM sales WHERE id = ?").run(saleId);

  const details = `${sale.product_name} × ${sale.quantity} — TZS ${Math.round(sale.total_revenue).toLocaleString("en-US")}${reason ? ` | Sababu: ${reason}` : ""}`;
  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'deleted a sale', ?, ?, ?)`,
  ).run(genId("al"), details, actorName || null, new Date().toISOString());
});

function deleteSale(saleId, actorName, reason) {
  try {
    deleteSaleTx(saleId, actorName, reason);
    return { success: true };
  } catch (err) {
    if (
      err instanceof CartValidationError &&
      err.message === "SALE_NOT_FOUND"
    ) {
      return { success: false, error: "Muuzo haupatikani" };
    }
    throw err;
  }
}

// Same overpayment-prevention reasoning as recordSupplierPayment — the
// balance check and the write happen in the same transaction, closing
// the same race a separate read-then-write would leave open.
const recordCreditPaymentTx = db.transaction(
  (creditSaleId, amount, paymentMethod) => {
    const cs = db
      .prepare("SELECT * FROM credit_sales WHERE id = ?")
      .get(creditSaleId);
    if (!cs) throw new CartValidationError("Deni halipatikani");

    const remaining = cs.total_amount - cs.amount_paid;
    if (amount > remaining)
      throw new CartValidationError(
        `Kiasi kinazidi deni lililobaki (${Math.round(remaining)})`,
      );

    const newAmountPaid = cs.amount_paid + amount;
    const newStatus = newAmountPaid >= cs.total_amount ? "paid" : "partial";
    const date = new Date().toISOString();

    db.prepare(
      "UPDATE credit_sales SET amount_paid = ?, status = ? WHERE id = ?",
    ).run(newAmountPaid, newStatus, creditSaleId);
    db.prepare(
      "INSERT INTO credit_sale_payments (id, credit_sale_id, amount, payment_method, date) VALUES (?, ?, ?, ?, ?)",
    ).run(genId("ccp"), creditSaleId, amount, paymentMethod || "", date);
    db.prepare(
      `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'recorded a credit payment', ?, NULL, ?)`,
    ).run(
      genId("al"),
      `${cs.customer_name} — TZS ${Math.round(amount).toLocaleString("en-US")}`,
      date,
    );

    return newStatus;
  },
);

function recordCreditPayment(creditSaleId, amount, paymentMethod, options = {}) {
  try {
    const result=creditDomain.paymentTx({ creditSaleId, amount, paymentMethod, operationId:options.operationId, actorName:options.actorName, accountId:options.accountId, accountLabel:options.accountLabel, accountNumber:options.accountNumber });
    const inv=db.prepare('SELECT id,total FROM invoices WHERE credit_sale_id=?').get(creditSaleId);
    if(inv){ const status=result.status==='paid'?'paid':'partial'; db.prepare('UPDATE invoices SET amount_paid=?,status=?,updated_at=? WHERE id=?').run(result.amountPaid,status,new Date().toISOString(),inv.id); }
    return { success:true,isFullySettled:result.status === "paid",payment:result };
  } catch (err) {
    if (err.message === "PAYMENT_EXCEEDS_BALANCE") return { success:false,error:`Kiasi kinazidi deni lililobaki (${Math.round(err.remaining)})` };
    const map={INVALID_PAYMENT_AMOUNT:"Weka kiasi sahihi",CREDIT_NOT_FOUND:"Deni halipatikani",IDEMPOTENCY_CONFLICT:"Ombi hili limetumika tayari kwa taarifa tofauti"};
    return { success:false,error:map[err.code || err.message] || err.message };
  }
}

// Deleting a credit sale isn't just removing a record — the goods it
// represented left the shelf when it was created. Each line item
// restores its OWN product using its OWN batch breakdown — a credit sale
// covering two different products correctly gives each one back its own
// real batches at its own real prices, not a single blended restoration
// across unrelated products. Tested directly with two products, each
// with a distinct breakdown, confirming both restore independently and
// correctly.
const deleteCreditSaleTx = db.transaction((creditSaleId) => {
  const cs = db
    .prepare("SELECT * FROM credit_sales WHERE id = ?")
    .get(creditSaleId);
  if (!cs) throw new CartValidationError("Deni halipatikani");

  const items = db
    .prepare("SELECT * FROM credit_sale_items WHERE credit_sale_id = ?")
    .all(creditSaleId);
  const restoreDate = new Date().toISOString();

  for (const item of items) {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(item.product_id);
    if (!product) continue; // product itself was deleted since — nothing to restore stock to

    const breakdown = item.batch_breakdown
      ? JSON.parse(item.batch_breakdown)
      : null;
    const fallbackCost = item.cost_at_sale ?? product.buying_price ?? 0;
    restoreBatchesFromBreakdown(
      item.product_id,
      breakdown,
      item.quantity,
      fallbackCost,
      restoreDate,
    );
  }

  db.prepare("DELETE FROM credit_sales WHERE id = ?").run(creditSaleId); // cascades items + payments

  db.prepare(
    `INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, 'deleted a credit sale', ?, NULL, ?)`,
  ).run(
    genId("al"),
    `${cs.customer_name} — TZS ${Math.round(cs.total_amount).toLocaleString("en-US")}`,
    restoreDate,
  );
});

function deleteCreditSale(creditSaleId, options = {}) {
  try { creditDomain.deleteTx({ creditSaleId, operationId:options.operationId, actorName:options.actorName }); return { success:true }; }
  catch (err) { const map={CREDIT_NOT_FOUND:"Deni halipatikani",IDEMPOTENCY_CONFLICT:"Ombi hili limetumika tayari kwa taarifa tofauti"}; return { success:false,error:map[err.code || err.message] || err.message }; }
}

function getActivityLog() {
  return db
    .prepare("SELECT * FROM activity_log ORDER BY date DESC")
    .all()
    .map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      actorName: a.actor_name,
      date: a.date,
    }));
}

const saveActivityLog = db.transaction((log) => {
  db.prepare("DELETE FROM activity_log").run();
  const insert = db.prepare(`
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (@id, @action, @details, @actorName, @date)
  `);
  for (const a of log) {
    insert.run({
      id: a.id,
      action: a.action,
      details: a.details ?? null,
      actorName: a.actorName ?? null,
      date: a.date,
    });
  }
});

const appendActivityLogTx = db.transaction((a) => {
  db.prepare(`INSERT INTO activity_log (id, action, details, actor_name, date) VALUES (?, ?, ?, ?, ?)`)
    .run(a.id, a.action, a.details ?? null, a.actorName ?? null, a.date || new Date().toISOString());
  // Bound local diagnostic UI history without rewriting the table on every event.
  db.prepare(`DELETE FROM activity_log WHERE id IN (SELECT id FROM activity_log ORDER BY date DESC LIMIT -1 OFFSET 500)`).run();
});
function appendActivityLog(a) { appendActivityLogTx(a); return { success: true }; }

function getCrashLog() {
  return db
    .prepare("SELECT * FROM crash_log ORDER BY timestamp DESC")
    .all()
    .map((c) => ({
      id: c.id,
      message: c.message,
      stack: c.stack,
      context: c.context,
      timestamp: c.timestamp,
    }));
}

const saveCrashLog = db.transaction((log) => {
  db.prepare("DELETE FROM crash_log").run();
  const insert = db.prepare(`
    INSERT INTO crash_log (id, message, stack, context, timestamp)
    VALUES (@id, @message, @stack, @context, @timestamp)
  `);
  for (const c of log) {
    insert.run({
      id: c.id,
      message: c.message,
      stack: c.stack ?? null,
      context: c.context ?? null,
      timestamp: c.timestamp,
    });
  }
});

const appendCrashLogTx = db.transaction((entry) => {
  db.prepare(`INSERT INTO crash_log (id, message, stack, context, timestamp) VALUES (@id, @message, @stack, @context, @timestamp)`).run({
    id: entry.id || genId("crash"), message: String(entry.message || "").slice(0, 2000),
    stack: entry.stack ? String(entry.stack).slice(0, 4000) : null, context: entry.context || null,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  db.prepare(`DELETE FROM crash_log WHERE id IN (SELECT id FROM crash_log ORDER BY timestamp DESC LIMIT -1 OFFSET 200)`).run();
});
function appendCrashLog(entry) { appendCrashLogTx(entry || {}); return { success: true }; }
function clearCrashLog() { db.prepare("DELETE FROM crash_log").run(); return { success: true }; }


function getAccountSummary() {
  const settings = getSettings();
  const accounts = Array.isArray(settings.paymentAccounts) ? settings.paymentAccounts : [];
  const totals = db.prepare(`SELECT account_id,
    SUM(CASE WHEN direction='in' THEN amount ELSE 0 END) AS money_in,
    SUM(CASE WHEN direction='out' THEN amount ELSE 0 END) AS money_out,
    COUNT(*) AS entries
    FROM account_ledger GROUP BY account_id`).all();
  const byId = new Map(totals.map(r => [r.account_id, r]));
  const recentStmt = db.prepare(`SELECT id,direction,amount,entry_type,reference_type,reference_id,description,date
    FROM account_ledger WHERE account_id=? ORDER BY date DESC,id DESC LIMIT 5`);
  return accounts.map(a => {
    const t=byId.get(a.id)||{money_in:0,money_out:0,entries:0};
    const opening=Number(a.openingBalance||0), moneyIn=Number(t.money_in||0), moneyOut=Number(t.money_out||0);
    return {id:a.id,label:a.label||'',accountNumber:a.accountNumber||'',type:a.type||'',openingBalance:opening,moneyIn,moneyOut,balance:opening+moneyIn-moneyOut,entries:Number(t.entries||0),recent:recentStmt.all(a.id).map(x=>({id:x.id,direction:x.direction,amount:x.amount,entryType:x.entry_type,referenceType:x.reference_type,referenceId:x.reference_id,description:x.description,date:x.date}))};
  });
}

function getAccountStatement(args = {}) {
  const accountId = String(args.accountId || '').trim();
  if (!accountId) return { rows: [], total: 0, moneyIn: 0, moneyOut: 0 };
  const clauses = ['account_id = @accountId'];
  const params = { accountId };
  if (args.start) { clauses.push('date >= @start'); params.start = args.start; }
  if (args.end) { clauses.push('date < @end'); params.end = args.end; }
  if (args.entryType) { clauses.push('entry_type = @entryType'); params.entryType = args.entryType; }
  const where = clauses.join(' AND ');
  const limit = Math.max(1, Math.min(5000, Number(args.limit) || 1000));
  const offset = Math.max(0, Number(args.offset) || 0);
  const totals = db.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0) AS money_in,
    COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS money_out
    FROM account_ledger WHERE ${where}`).get(params);
  const rows = db.prepare(`SELECT id,account_id,account_label,account_number,direction,amount,entry_type,reference_type,reference_id,description,date,created_at
    FROM account_ledger WHERE ${where} ORDER BY date DESC,id DESC LIMIT @limit OFFSET @offset`).all({...params,limit,offset});
  return { rows: rows.map(r=>({id:r.id,accountId:r.account_id,accountLabel:r.account_label,accountNumber:r.account_number,direction:r.direction,amount:Number(r.amount||0),entryType:r.entry_type,referenceType:r.reference_type,referenceId:r.reference_id,description:r.description,date:r.date,createdAt:r.created_at})), total:Number(totals.total||0), moneyIn:Number(totals.money_in||0), moneyOut:Number(totals.money_out||0) };
}

function getSettings() {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
  return row
    ? JSON.parse(row.data)
    : { businessName: "", ownerPin: "", ownerPhone: "" };
}

function saveSettings(settings) {
  db.prepare(
    `
    INSERT INTO settings (id, data) VALUES (1, @data)
    ON CONFLICT(id) DO UPDATE SET data = @data
  `,
  ).run({ data: JSON.stringify(settings) });
}

// Reverse case of the addStaff/updateStaff PIN check - if the owner's
// new PIN happened to match an existing staff member's PIN, that staff
// member would log in as the full-access owner instead of themselves
// the next time they entered their own PIN. Same underlying risk,
// closed from the other direction.
function resetOwnerPin(newPin) {
  if (!newPin || newPin.length < 4)
    return { success: false, error: "PIN lazima iwe na tarakimu 4 au zaidi" };

  const existing = db
    .prepare("SELECT COUNT(*) as c FROM staff WHERE pin = ?")
    .get(newPin);
  if (existing.c > 0)
    return {
      success: false,
      error: "PIN hii inatumika na mfanyakazi — chagua PIN tofauti",
    };

  const settings = getSettings();
  const updated = { ...settings, ownerPin: newPin };
  saveSettings(updated);
  return { success: true, settings: updated };
}

const genId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

// The first service migrated to genuinely granular SQL, as the template
// for the rest. Everything the old renderer-side salesService.js did in
// JavaScript — load the product, walk batches oldest-first, update or
// drop each one, recompute the product's summary, insert the sale — now
// happens as real SQL statements, wrapped in one database transaction.
// If anything throws partway through, better-sqlite3 rolls back
// everything: a failed sale can never leave stock half-consumed with no
// sale record to show for it. Tested against the exact FIFO scenarios
// batchService.js already proved (consumption spanning two batches at
// different prices, oversell rejection with zero mutation) before this
// was trusted to replace that logic.
function normalizeCartItems(cartItems) {
  const byProduct = new Map();
  for (const item of cartItems || []) {
    const key = item.productId;
    if (!key) throw new SalesDomainError("Bidhaa haijulikani");
    const existing = byProduct.get(key);
    if (!existing) {
      byProduct.set(key, { ...item, discount: item.discount || 0 });
      continue;
    }
    if (Number(existing.sellingPrice) !== Number(item.sellingPrice)) {
      throw new SalesDomainError(`${item.productName}: bei mbili tofauti kwenye kikapu`);
    }
    existing.quantity = Number(existing.quantity) + Number(item.quantity);
    existing.discount = Number(existing.discount || 0) + Number(item.discount || 0);
  }
  return [...byProduct.values()];
}

class CartValidationError extends Error {}
const repositories = createRepositories(db);
const transactionRunner = createTransactionRunner(db);
const inventory = createInventoryService(repositories.inventory, repositories.products, CartValidationError);
const salesDomain = createSalesService({ inventory, repositories, transactionRunner, idFactory: genId });
const purchaseDomain = createPurchaseService({ inventory, repositories, transactionRunner, idFactory: genId });
const creditDomain = createCreditService({ inventory, repositories, transactionRunner, idFactory: genId });
const expenseDomain = createExpenseService({ repositories, transactionRunner, idFactory: genId });

function completeSale(args) {
  const grossTotal = Number(args.sellingPrice) * Number(args.quantity);
  if (!args.quantity || Number(args.quantity) <= 0) return { success: false, error: "Weka kiasi sahihi" };
  if (!args.sellingPrice || Number(args.sellingPrice) <= 0) return { success: false, error: "Weka bei sahihi ya kuuza" };
  if (Number(args.discount || 0) < 0) return { success: false, error: "Punguzo haliwezi kuwa hasi" };
  if (Number(args.discount || 0) >= grossTotal) return { success: false, error: "Punguzo haliwezi kuzidi bei ya jumla" };
  try {
    return { success: true, sale: salesDomain.completeSingleTx(args) };
  } catch (err) {
    if (err.message === "IDEMPOTENCY_CONFLICT") return { success: false, error: "Ombi hili limetumika tayari kwa taarifa tofauti" };
    if (err.message === "PRODUCT_NOT_FOUND" || /haipatikani tena/.test(err.message)) return { success: false, error: "Bidhaa haipatikani" };
    if (err.message === "INSUFFICIENT_STOCK" || /stoo haitoshi/.test(err.message)) return { success: false, error: err.message.includes(":") ? err.message : "Stoo haitoshi" };
    if (err instanceof SalesDomainError) return { success: false, error: err.message };
    throw err;
  }
}

function completeCartSale(cartItems, meta = {}) {
  if (!cartItems || cartItems.length === 0) return { success: false, error: "Hakuna bidhaa kwenye kikapu" };
  try {
    const normalized = normalizeCartItems(cartItems);
    return { success: true, sales: salesDomain.completeCartTx(normalized, meta) };
  } catch (err) {
    if (err.message === "IDEMPOTENCY_CONFLICT") return { success: false, error: "Ombi hili limetumika tayari kwa taarifa tofauti" };
    if (err instanceof SalesDomainError || err instanceof CartValidationError) return { success: false, error: err.message };
    throw err;
  }
}

// A credit sale is a real sale — the goods leave the shelf immediately,
// same FIFO consumption and same all-or-nothing guarantee as a cash cart
// sale. The one thing that has to be exactly right here: costAtSale on
// each item. It's what lets deleteCreditSale correctly restore stock as
// a real batch later, at the price it was actually sold at — not a
// blended average that's drifted since. Tested directly before trusting
// this, including that costAtSale reflects genuine FIFO cost across
// multiple batches, not just the product's current average.
const completeCreditSaleTx = db.transaction(
  (cartItems, customerName, customerPhone, actorName, orderId) => {
    const creditSaleId = genId("cs");
    let totalAmount = 0;
    const itemInserts = [];

    for (const item of cartItems) {
      if (!item.quantity || item.quantity <= 0) {
        throw new CartValidationError(`${item.productName}: weka kiasi sahihi`);
      }
      if (!item.sellingPrice || item.sellingPrice <= 0) {
        throw new CartValidationError(
          `${item.productName}: weka bei sahihi ya kuuza`,
        );
      }

      const product = db
        .prepare("SELECT * FROM products WHERE id = ?")
        .get(item.productId);
      if (!product) {
        throw new CartValidationError(`${item.productName} haipatikani tena`);
      }

      let consumption;
      try {
        consumption = inventory.consumeFIFO(item.productId, item.quantity);
      } catch (err) {
        if (err instanceof CartValidationError && err.message === "INSUFFICIENT_STOCK") {
          throw new CartValidationError(
            `${item.productName}: stoo haitoshi (${err.available} pekee zimebaki)`,
          );
        }
        throw err;
      }
      const { totalCost, breakdown, effectiveBuyingPrice } = consumption;
      totalAmount += item.quantity * item.sellingPrice;

      itemInserts.push({
        id: genId("cci"),
        creditSaleId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: effectiveBuyingPrice,
        batchBreakdown: breakdown,
        productCategory: product.category || null,
        productBrand: product.brand || null,
        productUnit: product.unit || null,
        productImageUri: product.image_uri || null,
        productSize: product.size || null,
      });
    }

    const date = new Date().toISOString();
    db.prepare(
      `
    INSERT INTO credit_sales (id, customer_name, customer_phone, total_amount, amount_paid, status, date, actor_name)
    VALUES (?, ?, ?, ?, 0, 'pending', ?, ?)
  `,
    ).run(
      creditSaleId,
      customerName,
      customerPhone,
      totalAmount,
      date,
      actorName || null,
    );

    const insertItem = db.prepare(`
    INSERT INTO credit_sale_items (id, credit_sale_id, product_id, product_name, quantity, selling_price, cost_at_sale, batch_breakdown, product_category, product_brand, product_unit, product_image_uri, product_size)
    VALUES (@id, @creditSaleId, @productId, @productName, @quantity, @sellingPrice, @costAtSale, @breakdownJson, @productCategory, @productBrand, @productUnit, @productImageUri, @productSize)
  `);
    for (const item of itemInserts) {
      insertItem.run({
        id: item.id,
        creditSaleId: item.creditSaleId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        costAtSale: item.costAtSale,
        breakdownJson: JSON.stringify(item.batchBreakdown),
        productCategory: item.productCategory,
        productBrand: item.productBrand,
        productUnit: item.productUnit,
        productImageUri: item.productImageUri,
        productSize: item.productSize,
      });
    }

    if (orderId) {
      const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId);
      if (!order) throw new CartValidationError("Oda haipatikani");
      if (order.status !== "pending") throw new CartValidationError("Oda tayari imefungwa");
      db.prepare("UPDATE orders SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?")
        .run(date, orderId);
    }

    db.prepare(
      `
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (?, 'sold on credit', ?, NULL, ?)
  `,
    ).run(
      genId("al"),
      `${customerName} — TZS ${Math.round(totalAmount).toLocaleString("en-US")}`,
      date,
    );

    return {
      id: creditSaleId,
      customerName,
      customerPhone,
      items: itemInserts.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        costAtSale: i.costAtSale,
        batchBreakdown: i.batchBreakdown,
        productCategory: i.productCategory,
        productBrand: i.productBrand,
        productUnit: i.productUnit,
        productImageUri: i.productImageUri,
        productSize: i.productSize,
      })),
      totalAmount,
      amountPaid: 0,
      status: "pending",
      payments: [],
      date,
      actorName: actorName || null,
    };
  },
);

function completeCreditSale(args = {}) {
  try { return { success:true, creditSale:creditDomain.completeTx({ ...args, cartItems:normalizeCartItems(args.cartItems || []) }) }; }
  catch (err) {
    if (err.message === "INSUFFICIENT_STOCK") return { success:false,error:`${err.productName}: stoo haitoshi (${err.available} pekee zimebaki)` };
    const map={EMPTY_CREDIT_CART:"Hakuna bidhaa kwenye kikapu",CUSTOMER_REQUIRED:"Weka jina la mteja",INVALID_CREDIT_QUANTITY:"Weka kiasi sahihi",INVALID_CREDIT_PRICE:"Weka bei sahihi ya kuuza",PRODUCT_NOT_FOUND:"Bidhaa haipatikani tena",ORDER_NOT_FOUND:"Oda haipatikani",ORDER_CLOSED:"Oda tayari imefungwa",IDEMPOTENCY_CONFLICT:"Ombi hili limetumika tayari kwa taarifa tofauti"};
    return { success:false,error:map[err.code || err.message] || err.message };
  }
}

// An order ticket, not a sale — recorded before the customer ever
// reaches the cashier. order_number is computed as current-max-plus-one
// and inserted in the same transaction, so two orders created back to
// back can never collide on the same number, even though nothing here
// depends on that race actually being possible in a single-device app.
const createOrderTx = db.transaction(
  (issuedBy, customerName, customerPhone, items) => {
    const row = db.prepare("SELECT MAX(order_number) as m FROM orders").get();
    const nextNumber = (row.m || 0) + 1;
    const orderId = genId("ord");
    const date = new Date().toISOString();

    db.prepare(
      `
    INSERT INTO orders (id, order_number, issued_by, customer_name, customer_phone, status, date)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `,
    ).run(
      orderId,
      nextNumber,
      issuedBy || null,
      customerName || null,
      customerPhone || null,
      date,
    );

    const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, expected_price, product_brand, product_size, product_unit, product_category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    for (const item of items) {
      insertItem.run(
        genId("oi"),
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.expectedPrice ?? null,
        item.productBrand || null,
        item.productSize || null,
        item.productUnit || null,
        item.productCategory || null,
      );
    }

    return { id: orderId, orderNumber: nextNumber };
  },
);

function createOrder({ issuedBy, customerName, customerPhone, items }) {
  if (!items || items.length === 0)
    return { success: false, error: "Hakuna bidhaa kwenye oda" };
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      return {
        success: false,
        error: `${item.productName}: weka kiasi sahihi`,
      };
    }
  }
  const order = createOrderTx(issuedBy, customerName, customerPhone, items);
  return { success: true, order };
}

function getOrders() {
  const orders = db
    .prepare("SELECT * FROM orders ORDER BY order_number DESC")
    .all();
  const items = db.prepare("SELECT * FROM order_items").all();
  const itemsByOrder = {};
  for (const i of items) {
    (itemsByOrder[i.order_id] ||= []).push({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      expectedPrice: i.expected_price,
      productBrand: i.product_brand,
      productSize: i.product_size,
      productUnit: i.product_unit,
      productCategory: i.product_category,
    });
  }
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    issuedBy: o.issued_by,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    status: o.status,
    date: o.date,
    fulfilledAt: o.fulfilled_at,
    items: itemsByOrder[o.id] || [],
  }));
}

// Fulfilling doesn't touch stock or create a sale itself — that already
// happens through the normal cart-sale flow once the cashier loads the
// order's items in. This just marks the order as settled and guards
// against marking the same order fulfilled twice.
function fulfillOrder(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return { success: false, error: "Oda haipatikani" };
  if (order.status !== "pending")
    return {
      success: false,
      error: `Oda tayari ${order.status === "fulfilled" ? "imekamilika" : "imefutwa"}`,
    };

  db.prepare(
    `UPDATE orders SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), orderId);
  return { success: true };
}

function cancelOrder(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return { success: false, error: "Oda haipatikani" };
  if (order.status !== "pending")
    return {
      success: false,
      error: `Oda tayari ${order.status === "fulfilled" ? "imekamilika" : "imefutwa"}`,
    };

  db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(
    orderId,
  );
  return { success: true };
}

const restoreBackupDataTx = db.transaction((data) => {
  // JSON restore is retained for compatibility. v1.0 native SQLite snapshots
  // are preferred because they preserve the complete audit ledger/outbox.
  // Legacy JSON backups predate those tables, so reset the derived ledger and
  // let restored stock batches establish a clean opening baseline.
  db.prepare("DELETE FROM stock_movement_context").run();
  db.prepare("DELETE FROM stock_movements").run();
  saveProducts(data.products || []);
  saveSales(data.sales || []);
  saveCreditSales(data.creditSales || []);
  saveExpenditures(data.expenditures || []);
  saveSuppliers(data.suppliers || []);
  saveSettings(data.settings || {});
});

function restoreBackupData(data) {
  if (!data || (!Array.isArray(data.products) && !Array.isArray(data.sales))) {
    return { success: false, error: "INVALID_BACKUP" };
  }
  restoreBackupDataTx(data);
  return { success: true };
}

function getDashboardAnalytics(args) {
  return analyticsRepository.getDashboardAnalytics(args);
}

function getInventorySummary() {
  return analyticsRepository.getInventorySummary();
}

function getReceivablesSummary() {
  return analyticsRepository.getReceivablesSummary();
}

function getStaffSalesSummary() {
  return analyticsRepository.getStaffSalesSummary();
}

function getOverdueReceivablesSummary(args) {
  return analyticsRepository.getOverdueReceivablesSummary(args);
}

const adjustInventoryTx = db.transaction((args) => inventory.adjustStock({ ...args, idFactory: genId }));
function adjustInventory(args) {
  try {
    return { success: true, result: adjustInventoryTx(args || {}) };
  } catch (err) {
    if (err.message === 'INSUFFICIENT_STOCK') return { success: false, error: `Stoo haitoshi (${err.available} pekee zimebaki)` };
    if (err instanceof CartValidationError || ['INVALID_ADJUSTMENT','PRODUCT_NOT_FOUND'].includes(err.message)) return { success: false, error: err.message };
    throw err;
  }
}

function getStockMovements(productId, options) {
  return inventory.getMovementHistory(productId, options || {});
}

module.exports = {
  getReportData, getTaxSummary, createInvoice, getInvoiceByCreditSaleId, createSaleInvoice, getInvoiceBySaleId, listInvoices, createCommercialDocument, listCommercialDocuments, getCommercialDocument, convertQuotationToProforma, convertProformaToCreditSale, convertProformaToSale, updateCommercialDocumentStatus,
  getDashboardAnalytics,
  getInventorySummary,
  getReceivablesSummary,
  getOverdueReceivablesSummary,
  getStaffSalesSummary,
  adjustInventory,
  getStockMovements,
  getProducts,
  getProductsForBackup,
  saveProducts,
  upsertProducts,
  deleteProducts,
  getSales,
  getSalesPage,
  saveSales,
  getCreditSales,
  saveCreditSales,
  getExpenditures,
  saveExpenditures,
  addExpenditure,
  deleteExpenditure,
  getSuppliers,
  saveSuppliers,
  getStaff,
  saveStaff,
  getActivityLog,
  saveActivityLog,
  appendActivityLog,
  getCrashLog,
  saveCrashLog,
  appendCrashLog,
  clearCrashLog,
  getSettings,
  getAccountSummary,
  getAccountStatement,
  saveSettings,
  resetOwnerPin,
  completeSale,
  completeCartSale,
  completeCreditSale,
  addStaff,
  updateStaff,
  deleteStaff,
  identifyStaffByPin,
  addSupplier,
  deleteSupplier,
  recordSupply,
  recordSupplierPayment,
  addStock,
  completeRestockCart,
  editSale,
  deleteSale,
  recordCreditPayment,
  deleteCreditSale,
  createOrder,
  getOrders,
  fulfillOrder,
  cancelOrder,
  restoreBackupData,
};


