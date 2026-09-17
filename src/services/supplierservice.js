import { dataService } from "./DataService";

// Migrated to real SQL operations — recordPayment's overpayment check
// now reads the current balance and writes the update in the same
// database transaction, closing a real race that existed in the
// array-based version (two concurrent payments could each pass the
// "not more than owed" check against the same stale balance and
// together overpay). Tested directly: partial payment, paying the exact
// remaining balance, rejecting any further payment once fully paid, and
// confirming a deleted supplier's payment history cascades away with it.
export const supplierService = {
  async addSupplier({ name, phone }) {
    return dataService.addSupplier({ name, phone });
  },

  async deleteSupplier(supplierId) {
    return dataService.deleteSupplier(supplierId);
  },

  // Records new stock received from a supplier on credit — increases what
  // you owe them. Call this when restocking without paying the supplier
  // immediately.
  async recordSupply(supplierId, amount) {
    return dataService.recordSupply(supplierId, amount);
  },

  async recordPayment(supplierId, amount, paymentMethod) {
    return dataService.recordSupplierPayment(supplierId, amount, paymentMethod);
  },
};


