const { createProductRepository } = require('./productRepository');
const { createOperationReceiptRepository } = require('./operationReceiptRepository');
const { createActivityRepository } = require('./activityRepository');
const { createExpenseRepository } = require('./expenseRepository');
const { createOrderRepository } = require('./orderRepository');
const { createSaleRepository } = require('./saleRepository');
const { createInventoryRepository } = require('./inventoryRepository');
const { createCreditRepository } = require('./creditRepository');
const { createAccountLedgerRepository } = require('./accountLedgerRepository');
function createRepositories(db) { return {
  products:createProductRepository(db), receipts:createOperationReceiptRepository(db), activities:createActivityRepository(db),
  expenses:createExpenseRepository(db), orders:createOrderRepository(db), sales:createSaleRepository(db),
  inventory:createInventoryRepository(db), credit:createCreditRepository(db), accountLedger:createAccountLedgerRepository(db),
}; }
module.exports = { createRepositories };
