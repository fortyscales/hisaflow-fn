import { dataService } from "./DataService";
import { getCurrentActor } from "./ActivityLogService";

// One toggle per real area of the app, plus a single "full access" switch
// that flips them all at once — exactly what was asked for: an owner can
// hand a cashier as much or as little as they want, up to full owner-level
// access, and take any of it back at any time. Dashboard isn't gated —
// it's just numbers, nothing destructive lives there.
export const PERMISSION_KEYS = [
  "manageProducts",
  "manageSales",
  "manageCredit",
  "manageExpenses",
  "manageSuppliers",
  "manageStaff",
  "manageSettings",
];

export const emptyPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});

export const fullPermissions = () =>
  PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});

// The owner is never actually represented in the staff list — they're
// identified by matching settings.ownerPin at login, and implicitly have
// every permission without needing explicit flags. This helper is what
// login/permission checks use for that implicit owner identity.
export const ownerIdentity = () => ({
  id: "owner",
  name: "Owner",
  isOwner: true,
  permissions: fullPermissions(),
});

export const staffService = {
  // Migrated to real SQL operations — the PIN-uniqueness check (including
  // the self-exclusion case for updates) now happens as a direct query
  // rather than loading the whole staff array to check in JS. Tested
  // directly before trusting it: updating your own record while keeping
  // your existing PIN correctly succeeds, taking someone else's PIN
  // correctly fails.
  async addStaff({ name, pin, permissions }) {
    return dataService.addStaff({
      name,
      pin,
      permissions,
      actorName: getCurrentActor(),
    });
  },

  async updateStaff(staffId, { name, pin, permissions }) {
    return dataService.updateStaff(staffId, {
      name,
      pin,
      permissions,
      actorName: getCurrentActor(),
    });
  },

  async deleteStaff(staffId) {
    return dataService.deleteStaff(staffId, getCurrentActor());
  },

  // Checks a PIN against the owner first, then every staff member — used
  // at login to figure out both who's signing in and what they're allowed
  // to touch, in one pass. The owner check stays here rather than moving
  // to SQL, since it's just a string comparison against settings.ownerPin,
  // not a database lookup.
  async identifyByPin(pin, ownerPin) {
    if (pin === ownerPin) return ownerIdentity();
    return dataService.identifyStaffByPin(pin);
  },
};


