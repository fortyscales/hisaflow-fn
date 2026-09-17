const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'electron', 'migrations.js'), 'utf8');

assert(src.includes("if (!names.has('event_type')) return"), 'legacy event_type schema must be detected');
assert(src.includes('CREATE TABLE sync_outbox_v2_rebuild'), 'legacy outbox must be rebuilt, not patched around forever');
assert(src.includes("COALESCE(entity_type, event_type, 'legacy')") || src.includes("COALESCE(event_type, 'legacy')"), 'event_type must be preserved as entity_type');
assert(src.includes('DROP TABLE sync_outbox;'), 'obsolete NOT NULL event_type constraint must be removed');
assert(src.includes('ALTER TABLE sync_outbox_v2_rebuild RENAME TO sync_outbox'), 'canonical outbox must replace legacy table');

const preflight = src.indexOf('Compatibility preflight MUST run even when migration 1 is already recorded');
const appliedRead = src.indexOf("const applied = new Set");
assert(preflight >= 0 && preflight < appliedRead, 'legacy normalization must run before pending migration selection');

const normalizeCall = src.indexOf('db.transaction(() => normalizeLegacySyncOutbox(db))()', preflight);
assert(normalizeCall > preflight && normalizeCall < appliedRead, 'preflight must normalize legacy outbox transactionally');

const addEntityType = src.indexOf("addColumn(db, 'sync_outbox', 'entity_type'");
const entityIndex = src.indexOf('CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity');
assert(addEntityType >= 0 && entityIndex > addEntityType, 'canonical columns must exist before indexes');

console.log('v2.0.2 legacy outbox migration contract: PASS');
