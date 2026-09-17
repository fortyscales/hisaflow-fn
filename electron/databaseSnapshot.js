const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { db, DATA_DIR } = require('./db');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

function inspectSnapshot(snapshotPath, { full = true } = {}) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) return { ok: false, error: 'SNAPSHOT_NOT_FOUND' };
  let check;
  try {
    check = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    const integrity = check.pragma(full ? 'integrity_check' : 'quick_check', { simple: true });
    const foreignKeyIssues = check.pragma('foreign_key_check');
    const userVersion = check.pragma('user_version', { simple: true });
    const requiredTables = ['products','sales','stock_batches'];
    const tables = new Set(check.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all());
    const missingTables = requiredTables.filter((name) => !tables.has(name));
    return {
      ok: integrity === 'ok' && foreignKeyIssues.length === 0 && missingTables.length === 0,
      integrity, foreignKeyIssues, missingTables, userVersion,
      size: fs.statSync(snapshotPath).size,
      sha256: sha256File(snapshotPath),
    };
  } catch (error) {
    return { ok: false, error: 'SNAPSHOT_OPEN_FAILED', detail: error.message };
  } finally { if (check) check.close(); }
}

async function createDatabaseSnapshot(destinationPath) {
  const dir = destinationPath ? path.dirname(destinationPath) : path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const target = destinationPath || path.join(dir, `hisaflow-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  db.pragma('wal_checkpoint(PASSIVE)');
  await db.backup(target);
  const validation = inspectSnapshot(target, { full: true });
  if (!validation.ok) { fs.rmSync(target, { force: true }); throw new Error(`SNAPSHOT_INTEGRITY_FAILED:${validation.error || validation.integrity}`); }
  const manifest = {
    format: 'hisaflow-sqlite-snapshot', formatVersion: 1,
    createdAt: new Date().toISOString(), databaseUserVersion: validation.userVersion,
    size: validation.size, sha256: validation.sha256,
  };
  fs.writeFileSync(`${target}.manifest.json`, JSON.stringify(manifest, null, 2));
  return { path: target, ...manifest };
}

module.exports = { createDatabaseSnapshot, inspectSnapshot, sha256File };
