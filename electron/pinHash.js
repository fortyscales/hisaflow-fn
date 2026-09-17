const crypto = require("crypto");

// PINs are short and low-entropy (4-6 digits) — no hash makes them
// resistant to a determined offline brute force if the database itself
// is ever exposed. What hashing actually defends against here is the
// realistic threat: a PIN sitting in plain text inside a backup file
// someone exports and shares over WhatsApp or saves to a shared drive,
// where anyone who opens it could read every staff member's login PIN
// directly. scrypt with a random salt per PIN means the same PIN
// produces a different stored value for every person, and the stored
// value alone reveals nothing without redoing the (deliberately
// memory-hard) hash computation.
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Returns false (not throws) for anything that isn't a genuine salt:hash
// pair — covers both a wrong PIN and a not-yet-migrated plaintext value
// the same way, so callers never need to special-case either.
function verifyPin(pin, storedValue) {
  if (
    !storedValue ||
    typeof storedValue !== "string" ||
    !storedValue.includes(":")
  ) {
    return false;
  }
  const [salt, hash] = storedValue.split(":");
  if (!salt || !hash) return false;
  try {
    const hashToCompare = crypto
      .scryptSync(String(pin), salt, 64)
      .toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(hashToCompare, "hex");
    if (a.length !== b.length) return false; // timingSafeEqual requires equal-length buffers
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false; // malformed hex in a corrupted/tampered stored value
  }
}

// A plaintext PIN never contains ':' (PINs are digits only), while every
// value this module produces always does — cheap, reliable way to tell
// "already hashed" from "still needs migrating" without extra bookkeeping.
function looksHashed(storedValue) {
  return typeof storedValue === "string" && storedValue.includes(":");
}

module.exports = { hashPin, verifyPin, looksHashed };


