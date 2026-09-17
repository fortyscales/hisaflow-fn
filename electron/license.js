const crypto = require("crypto");
const { randomUUID } = crypto;
const { db } = require("./db");

// Fully offline licensing — no server anywhere in this app, so there's
// no channel for a remote "shut off now" signal. This is the honest,
// practical alternative: a locally-recorded trial period, unlocked by a
// key computed from this specific machine's ID. Worth being direct about
// its real limit — the secret below lives inside the packaged app, so
// someone who actually decompiled the bundle could work out how to
// generate their own key. That's a fundamentally different bar than a
// server-validated license, but a reasonable one for deterring casual
// non-payment from an ordinary small-shop customer, which is what this
// is actually for.
const SECRET = "HisaFlow-FortyScales-2026-LicenseSecret-v1";
const TRIAL_DAYS = 60;

function computeLicenseKey(machineId) {
  const digest = crypto
    .createHmac("sha256", SECRET)
    .update(machineId)
    .digest("hex")
    .toUpperCase();
  const raw = digest.slice(0, 16);
  return [
    raw.slice(0, 4),
    raw.slice(4, 8),
    raw.slice(8, 12),
    raw.slice(12, 16),
  ].join("-");
}

// A customer typing a key by hand shouldn't fail the check over
// lowercase letters or a stray space — normalize both sides the same way.
const normalizeKey = (key) =>
  (key || "").trim().toUpperCase().replace(/\s+/g, "");

function getOrCreateLicenseRow() {
  let row = db.prepare("SELECT * FROM license WHERE id = 1").get();
  if (!row) {
    const machineId = randomUUID();
    const installDate = new Date().toISOString();
    db.prepare(
      "INSERT INTO license (id, machine_id, install_date, licensed, license_key) VALUES (1, ?, ?, 0, NULL)",
    ).run(machineId, installDate);
    row = db.prepare("SELECT * FROM license WHERE id = 1").get();
  }
  return row;
}

function getLicenseStatus() {
  const row = getOrCreateLicenseRow();
  const installDate = new Date(row.install_date);
  const daysElapsed = Math.floor(
    (Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed);
  const licensed = row.licensed === 1;
  return {
    machineId: row.machine_id,
    installDate: row.install_date,
    licensed,
    daysRemaining,
    trialExpired: !licensed && daysRemaining <= 0,
  };
}

function activateLicense(enteredKey) {
  const row = getOrCreateLicenseRow();
  const expected = computeLicenseKey(row.machine_id);
  if (normalizeKey(enteredKey) !== normalizeKey(expected)) {
    return { success: false, error: "Nambari ya uanzishaji si sahihi" };
  }
  db.prepare(
    "UPDATE license SET licensed = 1, license_key = ? WHERE id = 1",
  ).run(normalizeKey(enteredKey));
  return { success: true };
}

module.exports = {
  getLicenseStatus,
  activateLicense,
  computeLicenseKey,
  TRIAL_DAYS,
};


