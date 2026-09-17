const assert = require('assert');
const Database = require('better-sqlite3');
const { createInventoryService } = require('../electron/domain/inventoryService');

class DomainError extends Error {}
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE products(id TEXT PRIMARY KEY, name TEXT, stock REAL DEFAULT 0, buying_price REAL DEFAULT 0, updated_at TEXT, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE stock_batches(
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), quantity REAL NOT NULL,
 remaining REAL NOT NULL, buying_price REAL NOT NULL, date TEXT NOT NULL, supplier_id TEXT,
 supplier_name TEXT, payment_method TEXT, account_id TEXT, account_label TEXT, account_number TEXT,
 updated_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
`);
db.prepare('INSERT INTO products(id,name) VALUES (?,?)').run('p1','Test');
const ins = db.prepare(`INSERT INTO stock_batches(id,product_id,quantity,remaining,buying_price,date) VALUES(?,?,?,?,?,?)`);
ins.run('a','p1',100,100,1000,'2026-01-01T00:00:00.000Z');
ins.run('b','p1',100,100,1500,'2026-02-01T00:00:00.000Z');
const inventory = createInventoryService(db, DomainError);
inventory.recomputeProductSummary('p1');
let p = db.prepare('SELECT stock,buying_price FROM products WHERE id=?').get('p1');
assert.equal(p.stock, 200);
assert.equal(p.buying_price, 1250);

const sold = db.transaction(() => inventory.consumeFIFO('p1', 120))();
assert.equal(sold.breakdown.length, 2);
assert.equal(sold.breakdown[0].batchId, 'a');
assert.equal(sold.breakdown[0].quantity, 100);
assert.equal(sold.breakdown[1].batchId, 'b');
assert.equal(sold.breakdown[1].quantity, 20);
assert.equal(sold.totalCost, 130000);
assert.equal(db.prepare('SELECT remaining FROM stock_batches WHERE id=?').pluck().get('a'), 0);

// Exact undo restores the original rows, not new batches with today's date.
db.transaction(() => inventory.restoreConsumption({
  productId:'p1', breakdown:sold.breakdown, totalQuantity:120,
  fallbackBuyingPrice:sold.effectiveBuyingPrice, fallbackDate:new Date().toISOString(),
  idFactory:(p)=>`${p}_fallback`
}))();
assert.equal(db.prepare('SELECT remaining FROM stock_batches WHERE id=?').pluck().get('a'), 100);
assert.equal(db.prepare('SELECT remaining FROM stock_batches WHERE id=?').pluck().get('b'), 100);
assert.equal(db.prepare('SELECT COUNT(*) FROM stock_batches').pluck().get(), 2);
assert.equal(inventory.assertProjection('p1').valid, true);

// Oversell must be safe inside a transaction.
assert.throws(() => db.transaction(() => inventory.consumeFIFO('p1', 201))(), /INSUFFICIENT_STOCK/);
assert.equal(inventory.assertProjection('p1').valid, true);
console.log('inventory-domain.test.js: PASS');
