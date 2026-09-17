import { dataService } from "./DataService";
import { getCurrentActor } from "./ActivityLogService";

// The entire creditService is now a thin layer over real SQL
// transactions in the main process.
export const creditService = {
  // Migrated to a real SQL transaction — same reasoning as
  // salesService.completeCartSale, since a credit sale is really a cart
  // sale with a different payment status. The costAtSale preserved per
  // item was tested directly: it reflects genuine FIFO cost across
  // whatever batches were actually consumed, not the product's current
  // blended average — this is what makes deleteCreditSale's stock
  // restoration correct later.
  async completeCreditSale({ cartItems, customerName, customerPhone, orderId }) {
    return dataService.completeCreditSale({
      cartItems,
      customerName,
      customerPhone,
      orderId: orderId || null,
      actorName: getCurrentActor(),
    });
  },

  // Migrated to a real SQL transaction — the "can't pay more than owed"
  // check reads the current balance and writes the update in the same
  // transaction, closing the same overpayment race that existed in
  // supplierService's original array-based version.
  async recordPayment(creditSaleId, amount, paymentMethod, account = null) {
    return dataService.recordCreditPayment(creditSaleId, amount, paymentMethod, account);
  },

  // Migrated to a real SQL transaction. Each line item restores its OWN
  // product using its OWN batch breakdown — tested directly with a
  // credit sale spanning two different products, confirming each one's
  // stock restores independently and correctly, not blended together.
  async deleteCreditSale(creditSaleId) {
    return dataService.deleteCreditSale(creditSaleId);
  },
};


