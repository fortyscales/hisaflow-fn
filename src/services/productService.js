import { dataService } from "./DataService";
import { batchService } from "./batchService";
import { supplierService } from "./supplierservice";

export const productService = {
  // Extracted verbatim from ProductsScreen.handleSaveProduct so both
  // screens that can create/edit a product share the exact same
  // behavior: preserving createdAt on edits, giving a brand new product
  // with initial stock a real first batch, and recording the supplier
  // link/payment method either way. Returns the full updated products
  // array (already persisted) so the caller can just setProducts(...).
  async saveProduct({
    product,
    supplierLink,
    stockPaymentMethod,
    stockPaymentAccount,
    existingProducts,
  }) {
    const existingProduct = existingProducts.find((p) => p.id === product.id);
    const exists = !!existingProduct;
    const productWithCreatedAt = {
      ...product,
      createdAt: exists ? existingProduct.createdAt : new Date().toISOString(),
    };
    const finalProduct =
      !exists && productWithCreatedAt.stock > 0
        ? batchService.addBatch(
            {
              ...productWithCreatedAt,
              stock: 0,
              buyingPrice: 0,
              stockBatches: [],
            },
            productWithCreatedAt.stock,
            productWithCreatedAt.buyingPrice,
            undefined,
            supplierLink
              ? {
                  supplierId: supplierLink.supplierId,
                  supplierName: supplierLink.supplierName,
                  paymentMethod: supplierLink.paymentMethod,
                  accountId: supplierLink.accountId || null,
                  accountLabel: supplierLink.accountLabel || "",
                  accountNumber: supplierLink.accountNumber || "",
                }
              : {
                  paymentMethod: stockPaymentMethod || null,
                  accountId: stockPaymentAccount?.accountId || null,
                  accountLabel: stockPaymentAccount?.accountLabel || "",
                  accountNumber: stockPaymentAccount?.accountNumber || "",
                },
          )
        : productWithCreatedAt;
    const updated = exists
      ? existingProducts.map((p) => (p.id === product.id ? finalProduct : p))
      : [...existingProducts, finalProduct];

    await dataService.upsertProducts([finalProduct]);

    if (supplierLink && supplierLink.isCredit) {
      await supplierService.recordSupply(
        supplierLink.supplierId,
        supplierLink.amount,
      );
    }

    return updated;
  },
};


