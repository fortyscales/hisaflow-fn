const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { db, DB_PATH, DATA_DIR } = require('./db');
const { createDatabaseSnapshot, inspectSnapshot } = require('./databaseSnapshot');

function validateRestoreCandidate(snapshotPath) {
  const candidate = inspectSnapshot(snapshotPath, { full: true });
  if (!candidate.ok) return candidate;
  const currentVersion = db.pragma('user_version', { simple: true });
  if (candidate.userVersion > currentVersion) {
    return { ...candidate, ok: false, error: 'BACKUP_FROM_NEWER_HISAFLOW', currentVersion };
  }
  return { ...candidate, currentVersion };
}

async function restoreDatabaseSnapshot(snapshotPath) {
  const validation = validateRestoreCandidate(snapshotPath);
  if (!validation.ok) return { success: false, ...validation };

  // A restore is destructive, so always make a verified rollback snapshot first.
  const recoveryDir = path.join(DATA_DIR, 'recovery');
  fs.mkdirSync(recoveryDir, { recursive: true });
  const safetyPath = path.join(recoveryDir, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  const safety = await createDatabaseSnapshot(safetyPath);

  const staged = `${DB_PATH}.restore-staged`;
  fs.copyFileSync(snapshotPath, staged);
  const stagedValidation = inspectSnapshot(staged, { full: true });
  if (!stagedValidation.ok) {
    fs.rmSync(staged, { force: true });
    return { success: false, error: 'STAGED_RESTORE_VALIDATION_FAILED', safetyBackup: safety.path };
  }

  // Stop all access before replacing the database. WAL/SHM belong to the old DB.
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  fs.rmSync(`${DB_PATH}-wal`, { force: true });
  fs.rmSync(`${DB_PATH}-shm`, { force: true });
  fs.copyFileSync(staged, DB_PATH);
  fs.rmSync(staged, { force: true });

  // Relaunch so migrations and startup health checks run against the restored file.
  app.relaunch();
  app.exit(0);
  return { success: true, safetyBackup: safety.path }; // normally process exits first
}

module.exports = { validateRestoreCandidate, restoreDatabaseSnapshot };
