#!/usr/bin/env node
const crypto = require("crypto");

// Kiza's own tool — never shipped to a customer's machine, never part of
// the packaged app. Run this after a customer pays, using the device
// code they send you (shown on their Trial Period Ended screen), and
// send back whatever this prints.
//
// The secret here MUST exactly match the one in electron/license.js —
// if you ever change one, change the other, or every previously-issued
// key stops working.
const SECRET = "HisaFlow-FortyScales-2026-LicenseSecret-v1";

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

const machineId = process.argv[2];

if (!machineId) {
  console.log("Usage: node generate-license.js <device-code-from-customer>");
  console.log(
    "Example: node generate-license.js a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  );
  process.exit(1);
}

console.log("\nDevice code:  " + machineId.trim());
console.log("License key:  " + computeLicenseKey(machineId.trim()) + "\n");


