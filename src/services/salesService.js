import { dataService } from "./DataService";
import { getCurrentActor } from "./ActivityLogService";

const newOperationId = () => globalThis.crypto?.randomUUID?.() || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// The entire salesService is now a thin layer over real SQL transactions
// in the main process — no more "load the whole array, modify in JS,
// save the whole array back." Kept as its own module rather than
// inlined into components for the same reason as always: what actually
// happens when a sale completes, changes, or gets removed shouldn't
// live inside a form component.
export const salesService = {
  // The first function migrated to a real, granular SQL transaction —
  // everything that used to happen here in JavaScript (load the whole
  // products array, run FIFO consumption, save the whole array back) now
  // happens atomically in the main process. Served as the template for
  // migrating completeCartSale, editSale, and deleteSale below, all of
  // which now follow the same pattern.
  async completeSale({
    productId,
    quantity,
    sellingPrice,
    paymentMethod,
    accountId,
    accountLabel,
    accountNumber,
    customerPhone,
    customerName,
    discount,
  }) {
    return dataService.completeSale({
      productId,
      quantity,
      sellingPrice,
      paymentMethod,
      accountId,
      accountLabel,
      accountNumber,
      customerPhone,
      customerName,
      discount,
      actorName: getCurrentActor(),
      operationId: newOperationId(),
    });
  },

  // Second function migrated to a real SQL transaction — same reasoning
  // as completeSale, extended to multiple products at once. The
  // all-or-nothing guarantee this relies on was tested directly before
  // trusting it: a cart with one oversold item rolls back completely,
  // including stock already consumed for another, individually-valid
  // item in the same cart — not just the one that failed.
  async completeCartSale(cartItems, meta = {}) {
    return dataService.completeCartSale(cartItems, {
      ...meta,
      actorName: getCurrentActor(),
      operationId: meta.operationId || newOperationId(),
    });
  },

  // Migrated to a real SQL transaction. The restore-then-reconsume
  // sequence — give back what the ORIGINAL sale took, then re-consume for
  // the NEW quantity — now happens atomically in the main process. Tested
  // directly before trusting it: editing to a quantity beyond what the
  // restore can support rolls back the restore too, not just the failed
  // re-consumption — stock ends up exactly as it was before the edit was
  // attempted, never half-restored.
  async editSale(saleId, { quantity, sellingPrice, notes, reason }) {
    return dataService.editSale(saleId, {
      quantity,
      sellingPrice,
      notes,
      reason,
      actorName: getCurrentActor(),
    });
  },

  // Migrated to a real SQL transaction — same restoreBatchesFromBreakdown
  // logic as editSale, just without a new quantity to re-consume.
  async deleteSale(saleId, reason) {
    return dataService.deleteSale(saleId, getCurrentActor(), reason);
  },
};


