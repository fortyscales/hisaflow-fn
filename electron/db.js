const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { app } = require("electron");
const { migrateFromJson } = require("./migrate");
const { runMigrations } = require("./migrations");

// This app originally stored everything as plain JSON files, deliberately —
// avoiding native module compilation risk and staying consistent with the
// phone app's AsyncStorage-based approach. That trade-off held up fine at
// small scale, but it has a real, structural limitation: every save reads
// a whole file, modifies it in JS, and writes the whole file back, with no
// true transaction isolation. A double-click race on credit sale deletion
// (fixed at the application layer, but the underlying gap remained) was
// the concrete proof this needed a real fix, not just a narrower one.
//
// SQLite closes that gap structurally: a sale becomes one real database
// transaction — decrement stock, insert the sale row, commit — atomic by
// construction, not by careful button-disabling in the UI.

const DATA_DIR = path.join(app.getPath("userData"), "hisaflow-data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "hisaflow.db");
const isNewDatabase = !fs.existsSync(DB_PATH); // must check before new Database() below, which creates the file
const db = new Database(DB_PATH);

// WAL mode: readers don't block writers and vice versa — the standard
// recommendation for a desktop app doing frequent small writes.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// Reliability/performance defaults for a single-user desktop database.
// NORMAL is durable with WAL while avoiding a full fsync on every commit;
// busy_timeout prevents transient lock contention from surfacing as an error.
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 5000");
db.pragma("temp_store = MEMORY");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      unit TEXT NOT NULL DEFAULT 'pc',
      selling_price REAL NOT NULL DEFAULT 0,
      buying_price REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      image_uri TEXT,
      expiry_date TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      remaining REAL NOT NULL,
      buying_price REAL NOT NULL,
      date TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT,
      payment_method TEXT,
      account_id TEXT,
      account_label TEXT,
      account_number TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_batches_product ON stock_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_batches_date ON stock_batches(date);
    CREATE INDEX IF NOT EXISTS idx_batches_product_fifo ON stock_batches(product_id, date, id);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      buying_price REAL,
      selling_price REAL NOT NULL,
      total_cost REAL,
      total_revenue REAL NOT NULL,
      profit REAL NOT NULL,
      payment_method TEXT,
      account_id TEXT,
      account_label TEXT,
      account_number TEXT,
      notes TEXT,
      date TEXT NOT NULL,
      edited_at TEXT,
      batch_breakdown TEXT,
      customer_phone TEXT,
      customer_name TEXT,
      discount REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);

    CREATE TABLE IF NOT EXISTS credit_sales (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      total_amount REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credit_sales_date ON credit_sales(date);
    CREATE INDEX IF NOT EXISTS idx_credit_sales_phone ON credit_sales(customer_phone);

    CREATE TABLE IF NOT EXISTS credit_sale_items (
      id TEXT PRIMARY KEY,
      credit_sale_id TEXT NOT NULL REFERENCES credit_sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      selling_price REAL NOT NULL,
      cost_at_sale REAL,
      batch_breakdown TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_credit_items_sale ON credit_sale_items(credit_sale_id);

    CREATE TABLE IF NOT EXISTS credit_sale_payments (
      id TEXT PRIMARY KEY,
      credit_sale_id TEXT NOT NULL REFERENCES credit_sales(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credit_payments_sale ON credit_sale_payments(credit_sale_id);

    CREATE TABLE IF NOT EXISTS expenditures (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenditures_date ON expenditures(date);

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      total_supplied REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);

    -- permissions stays as a JSON text blob rather than its own table —
    -- it's a small, fixed-shape object always read/written as a whole,
    -- never queried with a SQL WHERE clause ("find staff with permission
    -- X" isn't something this app does), so normalizing it further would
    -- add complexity without a real query benefit.
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      actor_name TEXT,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(date);

    CREATE TABLE IF NOT EXISTS crash_log (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      timestamp TEXT NOT NULL
    );

    -- Settings is one flat config object the app always reads/writes as a
    -- whole (business name, PIN, payment accounts, VAT settings, etc.) —
    -- a single JSON-blob row preserves that exact shape and the existing
    -- getSettings()/saveSettings(settings) interface with zero changes
    -- needed anywhere else in the app. The CHECK constraint makes a
    -- second row structurally impossible, not just a convention.
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    -- Deliberately its own table, not folded into settings — settings
    -- gets exported and re-imported through the normal backup/restore
    -- flow, and license state should never be touched by that. A trial
    -- reset via "restore a backup" would defeat the entire point of this.
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      machine_id TEXT NOT NULL,
      install_date TEXT NOT NULL,
      licensed INTEGER NOT NULL DEFAULT 0,
      license_key TEXT
    );
    -- An order ticket a staff member writes up for a customer before
    -- they reach the cashier — not a sale itself, but a record of what
    -- was promised and who promised it. order_number is sequential and
    -- human-facing (shown on the physical/printed ticket); the cashier
    -- later looks an order up by that number to fulfill it into a real
    -- sale, at which point stock actually leaves the shelf.
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL UNIQUE,
      issued_by TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      date TEXT NOT NULL,
      fulfilled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      expected_price REAL
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

    -- Database-level guard rails. The UI validates these too, but critical
    -- accounting/inventory invariants must survive future UI bugs or imports.
    CREATE TRIGGER IF NOT EXISTS trg_stock_batches_insert_guard
    BEFORE INSERT ON stock_batches
    WHEN NEW.quantity < 0 OR NEW.remaining < 0 OR NEW.remaining > NEW.quantity OR NEW.buying_price < 0
    BEGIN
      SELECT RAISE(ABORT, 'INVALID_STOCK_BATCH');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stock_batches_update_guard
    BEFORE UPDATE OF quantity, remaining, buying_price ON stock_batches
    WHEN NEW.quantity < 0 OR NEW.remaining < 0 OR NEW.remaining > NEW.quantity OR NEW.buying_price < 0
    BEGIN
      SELECT RAISE(ABORT, 'INVALID_STOCK_BATCH');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_credit_sales_insert_guard
    BEFORE INSERT ON credit_sales
    WHEN NEW.total_amount < 0 OR NEW.amount_paid < 0 OR NEW.amount_paid > NEW.total_amount
    BEGIN
      SELECT RAISE(ABORT, 'INVALID_CREDIT_BALANCE');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_credit_sales_update_guard
    BEFORE UPDATE OF total_amount, amount_paid ON credit_sales
    WHEN NEW.total_amount < 0 OR NEW.amount_paid < 0 OR NEW.amount_paid > NEW.total_amount
    BEGIN
      SELECT RAISE(ABORT, 'INVALID_CREDIT_BALANCE');
    END;
  `);
}

initSchema();

// CREATE TABLE IF NOT EXISTS only helps brand-new databases — an
// already-existing sales/credit_sale_items table (like the one already
// running with real data) needs its own column added explicitly. This
// checks first and only adds it if genuinely missing, so it's safe to
// run on every single startup without erroring on the second launch.
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing("sales", "batch_breakdown", "TEXT");
addColumnIfMissing("credit_sale_items", "batch_breakdown", "TEXT");
addColumnIfMissing("products", "created_at", "TEXT");
addColumnIfMissing("sales", "customer_phone", "TEXT");
addColumnIfMissing("sales", "customer_name", "TEXT");
addColumnIfMissing("sales", "discount", "REAL NOT NULL DEFAULT 0");
// Which specific configured payment account (not just "bank transfer" as a
// generic category) a restock was actually paid from — same idea as
// sales.account_id/account_label, so a batch can show "CRDB Business"
// instead of just "Bank Transfer" on the batch card.
addColumnIfMissing("stock_batches", "account_id", "TEXT");
addColumnIfMissing("stock_batches", "account_label", "TEXT");
// The account number itself (e.g. "0123456789"), alongside the label
// ("CRDB Business") already recorded above — so a batch or sale can
// show both, the same as the account picker does when it's selected.
addColumnIfMissing("stock_batches", "account_number", "TEXT");
addColumnIfMissing("sales", "account_number", "TEXT");

// A snapshot of the product as it actually was at the moment of sale -
// category, brand, unit, and image, captured once and never touched
// again. Without this, a sale record only ever reflects the product's
// current state, which drifts: the product could be renamed, its
// category changed, or deleted outright, and every past sale would
// silently show whatever it looks like today instead of what was
// actually sold. Nullable and left untouched for sales recorded before
// this existed - the UI falls back to plain text when these are empty,
// same pattern already used for batch_breakdown above.
addColumnIfMissing("sales", "product_category", "TEXT");
addColumnIfMissing("sales", "product_brand", "TEXT");
addColumnIfMissing("sales", "product_unit", "TEXT");
addColumnIfMissing("sales", "product_image_uri", "TEXT");
addColumnIfMissing("credit_sale_items", "product_category", "TEXT");
addColumnIfMissing("credit_sale_items", "product_brand", "TEXT");
addColumnIfMissing("credit_sale_items", "product_unit", "TEXT");
addColumnIfMissing("credit_sale_items", "product_image_uri", "TEXT");

// Who actually completed the transaction - captured once per sale/credit
// sale (not per line item, since one person completes the whole
// checkout), sourced from whoever's logged in when it happens. Nullable
// for the same reason as the product snapshot columns above: sales
// recorded before this existed simply have nothing here.
addColumnIfMissing("sales", "actor_name", "TEXT");
addColumnIfMissing("credit_sales", "actor_name", "TEXT");

// Optional size, distinct from unit - "Nondo" (rebar) sold by the piece
// can still come in 16mm vs other diameters, all sharing the same name
// and unit. Kept separate from category/brand since it's a per-variant
// detail, not a classification.
addColumnIfMissing("products", "size", "TEXT");
addColumnIfMissing("sales", "product_size", "TEXT");
addColumnIfMissing("credit_sale_items", "product_size", "TEXT");

// Existing products from before this fix have no created_at recorded.
// Backfilling with each product's earliest stock batch date is a
// reasonable proxy for "when this was first added" — far better than
// leaving it null (which would sort inconsistently) or defaulting
// everything to the same migration timestamp (which would make "newest
// first" meaningless for anything that existed before this update).
const productsNeedingBackfill = db
  .prepare("SELECT id FROM products WHERE created_at IS NULL")
  .all();
if (productsNeedingBackfill.length > 0) {
  const earliestBatchDate = db.prepare(
    "SELECT MIN(date) as date FROM stock_batches WHERE product_id = ?",
  );
  const setCreatedAt = db.prepare(
    "UPDATE products SET created_at = ? WHERE id = ?",
  );
  const now = new Date().toISOString();
  const backfill = db.transaction(() => {
    for (const p of productsNeedingBackfill) {
      const earliest = earliestBatchDate.get(p.id);
      setCreatedAt.run(earliest?.date || now, p.id);
    }
  });
  backfill();
}

// Apply explicit, sequential schema migrations after compatibility columns exist.
// This is the contract that lets SQLite evolve safely today and keeps the schema
// reproducible when the NestJS/PostgreSQL backend arrives.
runMigrations(db);

// Runs exactly once — isNewDatabase is only true the very first time this
// file exists (checked above, before better-sqlite3 created it). Every
// later launch, even seconds after, sees an existing hisaflow.db and
// skips this entirely, so there's no risk of re-importing and
// duplicating data on a second run.
if (isNewDatabase) {
  const result = migrateFromJson(db, DATA_DIR);
  if (result.migrated) {
    console.log("Migrated existing JSON data into SQLite:", result.counts);
  } else {
    console.log(
      "New database, no existing JSON data found to migrate (fresh install).",
    );
  }
}

// A product can end up with a stock count but zero actual stock_batches
// rows behind it — this happens when data comes from a source that
// doesn't track batch-level stock at all (the phone app, per
// backupService's own note that the two apps' data shapes differ here).
// saveProducts sets products.stock straight from whatever number was
// given, but if no stockBatches array came with it, nothing gets
// inserted into stock_batches — leaving a product that LOOKS like it
// has stock but is actually unsellable, since every sale path checks
// stock_batches directly, not the products.stock column. Synthesizes
// one batch per affected product from its existing stock/buying_price,
// same as batchService.migrateProduct already does for this exact case
// on the frontend — the backend just never had an equivalent repair.
const productsNeedingBatchRepair = db
  .prepare(
    `SELECT p.id, p.stock, p.buying_price, p.created_at FROM products p
     WHERE p.stock > 0
     AND COALESCE((SELECT SUM(remaining) FROM stock_batches WHERE product_id = p.id), 0) = 0`,
  )
  .all();
if (productsNeedingBatchRepair.length > 0) {
  const insertRepairBatch = db.prepare(`
    INSERT INTO stock_batches (id, product_id, quantity, remaining, buying_price, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const repair = db.transaction(() => {
    for (const p of productsNeedingBatchRepair) {
      const batchId = `batch_repair_${p.id}_${Math.random().toString(36).slice(2, 8)}`;
      insertRepairBatch.run(
        batchId,
        p.id,
        p.stock,
        p.stock,
        p.buying_price || 0,
        p.created_at || new Date().toISOString(),
      );
    }
  });
  repair();
  console.log(
    `Repaired ${productsNeedingBatchRepair.length} product(s) with stock but no sellable batches.`,
  );
}

module.exports = { db, DATA_DIR, DB_PATH };


