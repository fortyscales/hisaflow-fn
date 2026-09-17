const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const snapshot = fs.readFileSync(path.join(root, 'electron/databaseSnapshot.js'), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'electron/databaseRecovery.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
function assert(v, m) { if (!v) throw new Error(m); }
assert(snapshot.includes("'integrity_check'"), 'snapshot must receive full integrity validation');
assert(snapshot.includes('sha256'), 'snapshot must have checksum manifest');
assert(snapshot.includes('.manifest.json'), 'snapshot manifest missing');
assert(recovery.includes('BACKUP_FROM_NEWER_HISAFLOW'), 'schema compatibility guard missing');
assert(recovery.includes('pre-restore-'), 'pre-restore safety snapshot missing');
assert(recovery.includes('restore-staged'), 'staged restore missing');
assert(recovery.includes("wal_checkpoint(TRUNCATE)"), 'WAL checkpoint missing before restore');
assert(recovery.includes('app.relaunch()'), 'restore must relaunch through normal startup/migrations');
assert(main.includes('backup:validateSnapshot') && main.includes('backup:restoreSnapshot'), 'recovery IPC missing');
assert(preload.includes('validateDatabaseSnapshot') && preload.includes('restoreDatabaseSnapshot'), 'recovery preload API missing');
console.log('v1.7 backup/recovery contracts passed');
