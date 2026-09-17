const fs = require("fs");
const path = require("path");

const genId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Reads directly from the old JSON files rather than going through
// store.js's readFile — this needs to work even after store.js is
// eventually retired, and keeping it self-contained means the migration
// logic doesn't depend on the very system it's replacing.
const readJsonFile = (dataDir, key, fallback) => {
  try {
    const raw = fs.readFileSync(path.join(dataDir, `${key}.json`), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
};

// Runs once, only when the database is genuinely new — checked by the
// caller via whether hisaflow.db existed before this session opened it.
// Wrapped in a single transaction: if anything here throws partway
// through, better-sqlite3 rolls back everything, so a failed migration
// never leaves the new database half-populated while the old JSON files
// still hold the real data.
function migrateFromJson(db, dataDir) {
  const products = readJsonFile(dataDir, "products", []);
  const sales = readJsonFile(dataDir, "sales", []);
  const creditSales = readJsonFile(dataDir, "creditSales", []);
  const expenditures = readJsonFile(dataDir, "expenditures", []);
  const suppliers = readJsonFile(dataDir, "suppliers", []);
  const staff = readJsonFile(dataDir, "staff", []);
  const activityLog = readJsonFile(dataDir, "activityLog", []);
  const crashLog = readJsonFile(dataDir, "crashLog", []);
  const settings = readJsonFile(dataDir, "settings", null);

  const hasAnyData =
    products.length ||
    sales.length ||
    creditSales.length ||
    expenditures.length ||
    suppliers.length ||
    staff.length ||
    settings;

  if (!hasAnyData) {
    return { migrated: false, reason: "no existing data found" };
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, brand, unit, selling_price, buying_price, stock, image_uri, expiry_date)
    VALUES (@id, @name, @category, @brand, @unit, @sellingPrice, @buyingPrice, @stock, @imageUri, @expiryDate)
  `);
  const insertBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method)
    VALUES (@id, @productId, @quantity, @remaining, @buyingPrice, @date, @supplierId, @supplierName, @paymentMethod)
  `);
  const insertSale = db.prepare(`
    INSERT INTO sales (id, product_id, product_name, quantity, buying_price, selling_price, total_cost, total_revenue, profit, payment_method, account_id, account_label, notes, date, edited_at)
    VALUES (@id, @productId, @productName, @quantity, @buyingPrice, @sellingPrice, @totalCost, @totalRevenue, @profit, @paymentMethod, @accountId, @accountLabel, @notes, @date, @editedAt)
  `);
  const insertCreditSale = db.prepare(`
    INSERT INTO credit_sales (id, customer_name, customer_phone, total_amount, amount_paid, status, date)
    VALUES (@id, @customerName, @customerPhone, @totalAmount, @amountPaid, @status, @date)
  `);
  const insertCreditItem = db.prepare(`
    INSERT INTO credit_sale_items (id, credit_sale_id, product_id, product_name, quantity, selling_price, cost_at_sale)
    VALUES (@id, @creditSaleId, @productId, @productName, @quantity, @sellingPrice, @costAtSale)
  `);
  const insertCreditPayment = db.prepare(`
    INSERT INTO credit_sale_payments (id, credit_sale_id, amount, payment_method, date)
    VALUES (@id, @creditSaleId, @amount, @paymentMethod, @date)
  `);
  const insertExpenditure = db.prepare(`
    INSERT INTO expenditures (id, description, amount, type, date)
    VALUES (@id, @description, @amount, @type, @date)
  `);
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, phone, total_supplied, total_paid)
    VALUES (@id, @name, @phone, @totalSupplied, @totalPaid)
  `);
  const insertSupplierPayment = db.prepare(`
    INSERT INTO supplier_payments (id, supplier_id, amount, payment_method, date)
    VALUES (@id, @supplierId, @amount, @paymentMethod, @date)
  `);
  const insertStaff = db.prepare(`
    INSERT INTO staff (id, name, pin, permissions)
    VALUES (@id, @name, @pin, @permissions)
  `);
  const insertActivity = db.prepare(`
    INSERT INTO activity_log (id, action, details, actor_name, date)
    VALUES (@id, @action, @details, @actorName, @date)
  `);
  const insertCrash = db.prepare(`
    INSERT INTO crash_log (id, message, stack, context, timestamp)
    VALUES (@id, @message, @stack, @context, @timestamp)
  `);
  const insertSettings = db.prepare(
    `INSERT INTO settings (id, data) VALUES (1, @data)`,
  );

  const runMigration = db.transaction(() => {
    for (const p of products) {
      insertProduct.run({
        id: p.id,
        name: p.name,
        category: p.category || null,
        brand: p.brand || null,
        unit: p.unit || "pc",
        sellingPrice: p.sellingPrice || 0,
        buyingPrice: p.buyingPrice || 0,
        stock: p.stock || 0,
        imageUri: p.imageUri || null,
        expiryDate: p.expiryDate || null,
      });
      // Legacy products created before batch tracking existed won't have
      // a stockBatches array at all — nothing to migrate for those, the
      // product's own stock/buyingPrice fields already carry the truth.
      for (const b of p.stockBatches || []) {
        insertBatch.run({
          id: b.id || genId("batch"),
          productId: p.id,
          quantity: b.quantity,
          remaining: b.remaining,
          buyingPrice: b.buyingPrice,
          date: b.date,
          supplierId: b.supplierId || null,
          supplierName: b.supplierName || null,
          paymentMethod: b.paymentMethod || null,
        });
      }
    }

    for (const s of sales) {
      insertSale.run({
        id: s.id,
        productId: s.productId,
        productName: s.productName,
        quantity: s.quantity,
        buyingPrice: s.buyingPrice ?? null,
        sellingPrice: s.sellingPrice,
        totalCost: s.totalCost ?? null,
        totalRevenue: s.totalRevenue,
        profit: s.profit,
        paymentMethod: s.paymentMethod || null,
        accountId: s.accountId || null,
        accountLabel: s.accountLabel || null,
        notes: s.notes || null,
        date: s.date,
        editedAt: s.editedAt || null,
      });
    }

    for (const cs of creditSales) {
      insertCreditSale.run({
        id: cs.id,
        customerName: cs.customerName,
        customerPhone: cs.customerPhone || null,
        totalAmount: cs.totalAmount,
        amountPaid: cs.amountPaid || 0,
        status: cs.status || "pending",
        date: cs.date,
      });
      for (const item of cs.items || []) {
        insertCreditItem.run({
          id: genId("cci"),
          creditSaleId: cs.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          costAtSale: item.costAtSale ?? null,
        });
      }
      for (const pmt of cs.payments || []) {
        insertCreditPayment.run({
          id: genId("ccp"),
          creditSaleId: cs.id,
          amount: pmt.amount,
          paymentMethod: pmt.paymentMethod || null,
          date: pmt.date,
        });
      }
    }

    for (const e of expenditures) {
      insertExpenditure.run({
        id: e.id,
        description: e.description,
        amount: e.amount,
        type: e.type || null,
        date: e.date,
      });
    }

    for (const s of suppliers) {
      insertSupplier.run({
        id: s.id,
        name: s.name,
        phone: s.phone || null,
        totalSupplied: s.totalSupplied || 0,
        totalPaid: s.totalPaid || 0,
      });
      for (const pmt of s.payments || []) {
        insertSupplierPayment.run({
          id: genId("sp"),
          supplierId: s.id,
          amount: pmt.amount,
          paymentMethod: pmt.paymentMethod || null,
          date: pmt.date,
        });
      }
    }

    for (const st of staff) {
      insertStaff.run({
        id: st.id,
        name: st.name,
        pin: st.pin,
        permissions: JSON.stringify(st.permissions || {}),
      });
    }

    for (const a of activityLog) {
      insertActivity.run({
        id: a.id,
        action: a.action,
        details: a.details || null,
        actorName: a.actorName || null,
        date: a.date,
      });
    }

    for (const c of crashLog) {
      insertCrash.run({
        id: c.id,
        message: c.message,
        stack: c.stack || null,
        context: c.context || null,
        timestamp: c.timestamp,
      });
    }

    if (settings) {
      insertSettings.run({ data: JSON.stringify(settings) });
    }
  });

  runMigration();

  return {
    migrated: true,
    counts: {
      products: products.length,
      sales: sales.length,
      creditSales: creditSales.length,
      expenditures: expenditures.length,
      suppliers: suppliers.length,
      staff: staff.length,
      activityLog: activityLog.length,
      crashLog: crashLog.length,
      settings: settings ? 1 : 0,
    },
  };
}

module.exports = { migrateFromJson };


