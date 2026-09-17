const { db } = require('./db');

function getDatabaseHealth() {
  const integrity = db.pragma('quick_check', { simple: true });
  const foreignKeyIssues = db.pragma('foreign_key_check');
  const stockMismatches = db.prepare(`
    SELECT p.id, p.name, p.stock AS cached_stock,
           COALESCE(SUM(b.remaining), 0) AS batch_stock
    FROM products p
    LEFT JOIN stock_batches b ON b.product_id = p.id
    GROUP BY p.id
    HAVING ABS(p.stock - COALESCE(SUM(b.remaining), 0)) > 0.000001
    LIMIT 100
  `).all();
  const invalidBatches = db.prepare(`
    SELECT id, product_id, quantity, remaining, buying_price
    FROM stock_batches
    WHERE quantity < 0 OR remaining < 0 OR remaining > quantity OR buying_price < 0
    LIMIT 100
  `).all();
  const ledgerMismatches = db.prepare(`
    SELECT p.id, p.name,
           COALESCE((SELECT SUM(b.remaining) FROM stock_batches b WHERE b.product_id=p.id),0) AS batch_stock,
           COALESCE((SELECT SUM(m.quantity_delta) FROM stock_movements m WHERE m.product_id=p.id),0) AS ledger_stock
    FROM products p
    WHERE ABS(COALESCE((SELECT SUM(b.remaining) FROM stock_batches b WHERE b.product_id=p.id),0)
      - COALESCE((SELECT SUM(m.quantity_delta) FROM stock_movements m WHERE m.product_id=p.id),0)) > 0.000001
    LIMIT 100
  `).all();
  const orphanMovements = db.prepare(`
    SELECT m.id, m.product_id, m.movement_type, m.quantity_delta
    FROM stock_movements m LEFT JOIN products p ON p.id=m.product_id
    WHERE p.id IS NULL LIMIT 100
  `).all();
  const invalidCredits = db.prepare(`
    SELECT id, total_amount, amount_paid
    FROM credit_sales
    WHERE total_amount < 0 OR amount_paid < 0 OR amount_paid > total_amount
    LIMIT 100
  `).all();
  const invalidExpenses = db.prepare(`SELECT id, amount FROM expenditures WHERE amount <= 0 LIMIT 100`).all();
  const invalidCreditPayments = db.prepare(`SELECT id, credit_sale_id, amount FROM credit_sale_payments WHERE amount <= 0 LIMIT 100`).all();
  const invalidSupplierPayments = db.prepare(`SELECT id, supplier_id, amount FROM supplier_payments WHERE amount <= 0 LIMIT 100`).all();
  const pendingSyncEvents = db.prepare('SELECT COUNT(*) FROM sync_outbox WHERE synced_at IS NULL').pluck().get();
  const now = new Date().toISOString();
  const staleSyncLeases = db.prepare(`SELECT event_id, lease_token, lease_expires_at FROM sync_outbox
    WHERE synced_at IS NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND lease_expires_at <= ? LIMIT 100`).all(now);
  const invalidOperationReceipts = db.prepare(`SELECT operation_id, command_type FROM operation_receipts
    WHERE response_json IS NULL OR response_json = '' OR request_hash IS NULL OR request_hash = '' LIMIT 100`).all();
  return {
    ok: integrity === 'ok' && foreignKeyIssues.length === 0 && stockMismatches.length === 0 && ledgerMismatches.length === 0 && orphanMovements.length === 0 && invalidBatches.length === 0 && invalidCredits.length === 0 && invalidExpenses.length === 0 && invalidCreditPayments.length === 0 && invalidSupplierPayments.length === 0 && invalidOperationReceipts.length === 0,
    integrity,
    foreignKeyIssues,
    stockMismatches,
    ledgerMismatches,
    orphanMovements,
    invalidBatches,
    invalidCredits,
    invalidExpenses,
    invalidCreditPayments,
    invalidSupplierPayments,
    pendingSyncEvents,
    staleSyncLeases,
    invalidOperationReceipts,
    userVersion: db.pragma('user_version', { simple: true }),
  };
}

function repairCachedProductSummaries() {
  return db.transaction(() => {
    db.exec(`
      UPDATE products
      SET stock = COALESCE((SELECT SUM(remaining) FROM stock_batches WHERE product_id = products.id), 0),
          buying_price = CASE
            WHEN COALESCE((SELECT SUM(remaining) FROM stock_batches WHERE product_id = products.id), 0) > 0
            THEN COALESCE((SELECT SUM(remaining * buying_price) FROM stock_batches WHERE product_id = products.id), 0)
                 / (SELECT SUM(remaining) FROM stock_batches WHERE product_id = products.id)
            ELSE 0 END
    `);
    return getDatabaseHealth();
  })();
}

function getInventoryReconciliationReport(limit = 500) {
  const safeLimit = Math.min(2000, Math.max(1, Number(limit) || 500));
  return db.prepare(`
    SELECT p.id, p.name, p.stock AS cached_stock,
      COALESCE((SELECT SUM(b.remaining) FROM stock_batches b WHERE b.product_id=p.id),0) AS batch_stock,
      COALESCE((SELECT SUM(m.quantity_delta) FROM stock_movements m WHERE m.product_id=p.id),0) AS ledger_stock,
      COALESCE((SELECT SUM(b.remaining*b.buying_price) FROM stock_batches b WHERE b.product_id=p.id),0) AS inventory_value
    FROM products p
    WHERE ABS(p.stock - COALESCE((SELECT SUM(b.remaining) FROM stock_batches b WHERE b.product_id=p.id),0)) > 0.000001
       OR ABS(COALESCE((SELECT SUM(b.remaining) FROM stock_batches b WHERE b.product_id=p.id),0)
            - COALESCE((SELECT SUM(m.quantity_delta) FROM stock_movements m WHERE m.product_id=p.id),0)) > 0.000001
    ORDER BY p.name COLLATE NOCASE LIMIT ?
  `).all(safeLimit);
}

module.exports = { getDatabaseHealth, repairCachedProductSummaries, getInventoryReconciliationReport };
