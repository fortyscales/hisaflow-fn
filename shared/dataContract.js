/**
 * HisaFlow cross-runtime data contract.
 * Keep this dependency-free so the same rules can be reused by Electron today
 * and a NestJS API package later without importing SQLite-specific code.
 */
const DATA_MODEL_VERSION = 1;
const SYNC_PROTOCOL_VERSION = 1;
const ID_PATTERN = /^[a-z][a-z0-9_]*_[0-9a-f-]{16,}$/i;

function requireIdentity(value, name) {
  if (typeof value !== 'string' || value.trim().length < 8) throw new Error(`INVALID_${name.toUpperCase()}`);
  return value;
}
function normalizeIsoTimestamp(value, name = 'timestamp') {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new Error(`INVALID_${name.toUpperCase()}`);
  return d.toISOString();
}
function assertTenantRecord(record) {
  if (!record || typeof record !== 'object') throw new Error('INVALID_RECORD');
  requireIdentity(record.id, 'id');
  requireIdentity(record.shop_id ?? record.shopId, 'shop_id');
  if (record.device_id ?? record.deviceId) requireIdentity(record.device_id ?? record.deviceId, 'device_id');
  if (record.version != null && (!Number.isInteger(Number(record.version)) || Number(record.version) < 1)) throw new Error('INVALID_VERSION');
  return record;
}
function assertSyncEnvelope(event) {
  if (!event || event.protocolVersion !== SYNC_PROTOCOL_VERSION) throw new Error('UNSUPPORTED_SYNC_PROTOCOL');
  requireIdentity(event.eventId, 'event_id');
  requireIdentity(event.entityId, 'entity_id');
  requireIdentity(event.shopId, 'shop_id');
  requireIdentity(event.deviceId, 'device_id');
  if (!['UPSERT','DELETE'].includes(event.operation)) throw new Error('INVALID_SYNC_OPERATION');
  normalizeIsoTimestamp(event.occurredAt, 'occurred_at');
  return event;
}
module.exports = { DATA_MODEL_VERSION, SYNC_PROTOCOL_VERSION, ID_PATTERN, requireIdentity, normalizeIsoTimestamp, assertTenantRecord, assertSyncEnvelope };
