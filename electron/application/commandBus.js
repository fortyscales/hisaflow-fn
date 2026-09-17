'use strict';
const c=require('./contracts');
function createCommandBus({queries}){
  return {
    upsertProducts: input=>{const x=c.upsertProductsCommand(input);return queries.upsertProducts(x.products);},
    deleteProducts: input=>{const x=c.deleteProductsCommand(input);return queries.deleteProducts(x.productIds);},
    addStaff: input=>queries.addStaff(c.addStaffCommand(input)),
    updateStaff: input=>{const x=c.updateStaffCommand(input);return queries.updateStaff(x.staffId,x.data);},
    deleteStaff: input=>{const x=c.deleteStaffCommand(input);return queries.deleteStaff(x.staffId,x.actorName);},
    addSupplier: input=>queries.addSupplier(c.addSupplierCommand(input)),
    deleteSupplier: input=>{const x=c.deleteSupplierCommand(input);return queries.deleteSupplier(x.supplierId);},
    recordSupply: input=>{const x=c.recordSupplyCommand(input);return queries.recordSupply(x.supplierId,x.amount);},
    recordSupplierPayment: input=>{const x=c.recordSupplierPaymentCommand(input);return queries.recordSupplierPayment(x.supplierId,x.amount,x.paymentMethod);},
    editSale: input=>{const x=c.editSaleCommand(input);return queries.editSale(x.saleId,x.data);},
    deleteSale: input=>{const x=c.deleteSaleCommand(input);return queries.deleteSale(x.saleId,x.actorName,x.reason);},
    createOrder: input=>queries.createOrder(c.createOrderCommand(input)),
    fulfillOrder: input=>{const x=c.orderIdCommand(input);return queries.fulfillOrder(x.orderId);},
    cancelOrder: input=>{const x=c.orderIdCommand(input);return queries.cancelOrder(x.orderId);},
    appendActivityLog: input=>{const x=c.appendActivityLogCommand(input);return queries.appendActivityLog(x.entry);},
    appendCrashLog: input=>{const x=c.appendCrashLogCommand(input);return queries.appendCrashLog(x.entry);},
    clearCrashLog: ()=>queries.clearCrashLog(),
    completeSale: input=>queries.completeSale(c.completeSaleCommand(input)),
    completeCartSale: input=>{const x=c.completeCartSaleCommand(input);return queries.completeCartSale(x.items,x.meta);},
    completeCreditSale: input=>queries.completeCreditSale(c.completeCreditSaleCommand(input)),
    addStock: input=>queries.addStock(c.addStockCommand(input)),
    completeRestockCart: input=>{const x=c.completeRestockCartCommand(input);return queries.completeRestockCart(x.items,x.meta);},
    recordCreditPayment: input=>{const x=c.recordCreditPaymentCommand(input);return queries.recordCreditPayment(x.creditSaleId,x.amount,x.paymentMethod,{operationId:x.operationId,accountId:x.accountId,accountLabel:x.accountLabel,accountNumber:x.accountNumber});},
    deleteCreditSale: input=>{const x=c.deleteCreditSaleCommand(input);return queries.deleteCreditSale(x.creditSaleId,{operationId:x.operationId});},
    adjustInventory: input=>queries.adjustInventory(c.adjustInventoryCommand(input)),
    addExpense: input=>queries.addExpenditure(c.addExpenseCommand(input)),
    deleteExpense: input=>queries.deleteExpenditure(c.deleteExpenseCommand(input)),
  };
}
module.exports={createCommandBus};
