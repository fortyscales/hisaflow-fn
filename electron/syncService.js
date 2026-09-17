const { db } = require('./db');

const ENTITY_TABLES = Object.freeze({
  product: 'products', sale: 'sales', credit_sale: 'credit_sales',
  credit_sale_item: 'credit_sale_items', credit_payment: 'credit_sale_payments',
  expenditure: 'expenditures', supplier: 'suppliers', supplier_payment: 'supplier_payments',
  staff: 'staff', order: 'orders', order_item: 'order_items', stock_movement: 'stock_movements',
});

function meta(key) {
  return db.prepare('SELECT value FROM system_meta WHERE key=?').pluck().get(key) || null;
}
function identity() { return { shopId: meta('shop_id'), deviceId: meta('device_id'), protocolVersion: 1 }; }
function safeParse(value) { try { return value ? JSON.parse(value) : null; } catch { return null; } }
function rowSnapshot(entityType, entityId) {
  const table = ENTITY_TABLES[entityType];
  if (!table) return null;
  return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(entityId) || null;
}
function envelope(row) {
  const ident = identity();
  const snapshot = row.operation === 'DELETE' ? null : rowSnapshot(row.entity_type, row.entity_id);
  return {
    protocolVersion: 1,
    eventId: row.event_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation === 'DELETE' ? 'DELETE' : 'UPSERT',
    shopId: row.shop_id || ident.shopId,
    deviceId: row.device_id || ident.deviceId,
    occurredAt: row.created_at,
    entityVersion: snapshot?.version ?? row.entity_version ?? null,
    payload: snapshot || safeParse(row.payload),
    tombstone: row.operation === 'DELETE' ? { id: row.entity_id, deletedAt: row.created_at } : null,
  };
}

function getSyncStatus() {
  const counts = db.prepare(`SELECT
    SUM(CASE WHEN synced_at IS NULL AND dead_lettered_at IS NULL THEN 1 ELSE 0 END) pending,
    SUM(CASE WHEN synced_at IS NOT NULL THEN 1 ELSE 0 END) synced,
    SUM(CASE WHEN dead_lettered_at IS NOT NULL THEN 1 ELSE 0 END) deadLetter,
    COALESCE(MAX(attempts),0) maxAttempts
    FROM sync_outbox`).get();
  return { ...identity(), pending: counts.pending || 0, synced: counts.synced || 0, deadLetter: counts.deadLetter || 0, maxAttempts: counts.maxAttempts || 0, lastSuccessfulSyncAt: meta('last_successful_sync_at') };
}

function leasePendingEvents({ limit = 100, leaseSeconds = 60 } = {}) {
  limit = Math.max(1, Math.min(500, Number(limit) || 100));
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + Math.max(15, leaseSeconds) * 1000).toISOString();
  const token = `lease_${require('crypto').randomUUID()}`;
  const rows = db.transaction(() => {
    const selected = db.prepare(`SELECT * FROM sync_outbox
      WHERE synced_at IS NULL AND dead_lettered_at IS NULL
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
      ORDER BY id ASC LIMIT ?`).all(now.toISOString(), now.toISOString(), limit);
    const lock = db.prepare('UPDATE sync_outbox SET lease_token=?, lease_expires_at=? WHERE id=?');
    for (const r of selected) lock.run(token, leaseUntil, r.id);
    return selected;
  })();
  return { leaseToken: token, leaseExpiresAt: leaseUntil, events: rows.map(envelope) };
}

function acknowledgeEvents(leaseToken, eventIds) {
  if (!leaseToken || !Array.isArray(eventIds) || !eventIds.length) return { acknowledged: 0 };
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE sync_outbox SET synced_at=?, last_error=NULL, lease_token=NULL, lease_expires_at=NULL
    WHERE event_id=? AND lease_token=? AND synced_at IS NULL`);
  let acknowledged = 0;
  db.transaction(() => {
    for (const id of eventIds) acknowledged += stmt.run(now, id, leaseToken).changes;
    if (acknowledged) db.prepare(`INSERT INTO system_meta(key,value,updated_at) VALUES('last_successful_sync_at',?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(now, now);
  })();
  return { acknowledged };
}

function failEvents(leaseToken, failures = []) {
  if (!leaseToken || !Array.isArray(failures)) return { failed: 0 };
  const get = db.prepare('SELECT attempts FROM sync_outbox WHERE event_id=? AND lease_token=? AND synced_at IS NULL');
  const update = db.prepare(`UPDATE sync_outbox SET attempts=?, last_error=?, next_attempt_at=?, lease_token=NULL, lease_expires_at=NULL,
    dead_lettered_at=? WHERE event_id=? AND lease_token=? AND synced_at IS NULL`);
  let failed = 0;
  db.transaction(() => {
    for (const f of failures) {
      const row = get.get(f.eventId, leaseToken); if (!row) continue;
      const attempts = row.attempts + 1;
      const permanent = Boolean(f.permanent) || attempts >= 12;
      const delaySeconds = Math.min(3600, 5 * (2 ** Math.min(attempts - 1, 9)));
      const next = permanent ? null : new Date(Date.now() + delaySeconds * 1000).toISOString();
      failed += update.run(attempts, String(f.error || 'SYNC_FAILED').slice(0, 1000), next, permanent ? new Date().toISOString() : null, f.eventId, leaseToken).changes;
    }
  })();
  return { failed };
}

function releaseLease(leaseToken) {
  return { released: db.prepare(`UPDATE sync_outbox SET lease_token=NULL, lease_expires_at=NULL WHERE lease_token=? AND synced_at IS NULL`).run(leaseToken).changes };
}

module.exports = { identity, getSyncStatus, leasePendingEvents, acknowledgeEvents, failEvents, releaseLease };
