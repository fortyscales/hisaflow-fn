import { dataService } from "./DataService";

// Migrated to real SQL transactions. addStock still creates a genuinely
// new batch row rather than blending into one running average — same
// reasoning as before, now enforced by the database itself rather than
// JS array manipulation. completeRestockCart's all-or-nothing guarantee
// (a restock order covering several products commits completely or not
// at all) was tested directly: one valid product alongside one with a
// negative price correctly rolls back the valid one too.
export const restockService = {
  async addStock({
    productId,
    quantity,
    buyingPrice,
    supplierId,
    supplierName,
    paymentMethod,
    accountId,
    accountLabel,
    accountNumber,
  }) {
    return dataService.addStock({
      productId,
      quantity,
      buyingPrice,
      supplierId,
      supplierName,
      paymentMethod,
      accountId,
      accountLabel,
      accountNumber,
    });
  },

  async completeRestockCart(cartItems, meta = {}) {
    return dataService.completeRestockCart(cartItems, meta);
  },
};


