'use strict';
const { randomUUID } = require('crypto');

class ApplicationContractError extends Error {
  constructor(code, details) { super(code); this.name='ApplicationContractError'; this.code=code; this.details=details||null; }
}
const object=(value,code)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ApplicationContractError(code);return value;};
const requiredString=(value,code)=>{if(typeof value!=='string'||!value.trim())throw new ApplicationContractError(code);return value.trim();};
const optionalString=(value)=>value==null?null:String(value).trim()||null;
const positiveNumber=(value,code)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new ApplicationContractError(code);return n;};
const operationId=(value)=>value==null||String(value).trim()===''?`op_${randomUUID()}`:requiredString(value,'OPERATION_ID_REQUIRED');

function completeSaleCommand(input){const x=object(input,'INVALID_COMPLETE_SALE_COMMAND');return {...x,operationId:operationId(x.operationId),productId:requiredString(x.productId,'PRODUCT_ID_REQUIRED'),quantity:positiveNumber(x.quantity,'INVALID_QUANTITY'),sellingPrice:positiveNumber(x.sellingPrice,'INVALID_SELLING_PRICE'),actorName:optionalString(x.actorName)};}
function completeCartSaleCommand(input){const x=object(input,'INVALID_CART_SALE_COMMAND');if(!Array.isArray(x.items)||!x.items.length)throw new ApplicationContractError('EMPTY_CART');const meta=object(x.meta||{},'INVALID_CART_META');return {items:x.items,meta:{...meta,operationId:operationId(meta.operationId),actorName:optionalString(meta.actorName)}};}
function completeCreditSaleCommand(input){const x=object(input,'INVALID_CREDIT_SALE_COMMAND');return {...x,operationId:operationId(x.operationId),actorName:optionalString(x.actorName)};}
function addStockCommand(input){const x=object(input,'INVALID_ADD_STOCK_COMMAND');return {...x,operationId:operationId(x.operationId),productId:requiredString(x.productId,'PRODUCT_ID_REQUIRED'),quantity:positiveNumber(x.quantity,'INVALID_QUANTITY'),buyingPrice:Number(x.buyingPrice)};}
function completeRestockCartCommand(input){const x=object(input,'INVALID_RESTOCK_COMMAND');if(!Array.isArray(x.items)||!x.items.length)throw new ApplicationContractError('EMPTY_RESTOCK_CART');const meta=object(x.meta||{},'INVALID_RESTOCK_META');return {items:x.items,meta:{...meta,operationId:operationId(meta.operationId)}};}
function recordCreditPaymentCommand(input){const x=object(input,'INVALID_CREDIT_PAYMENT_COMMAND');return {creditSaleId:requiredString(x.creditSaleId,'CREDIT_SALE_ID_REQUIRED'),amount:positiveNumber(x.amount,'INVALID_PAYMENT_AMOUNT'),paymentMethod:optionalString(x.paymentMethod)||'cash',accountId:optionalString(x.accountId),accountLabel:optionalString(x.accountLabel),accountNumber:optionalString(x.accountNumber),operationId:operationId(x.operationId)};}
function deleteCreditSaleCommand(input){const x=object(input,'INVALID_DELETE_CREDIT_COMMAND');return {creditSaleId:requiredString(x.creditSaleId,'CREDIT_SALE_ID_REQUIRED'),operationId:operationId(x.operationId)};}
function adjustInventoryCommand(input){const x=object(input,'INVALID_INVENTORY_ADJUSTMENT_COMMAND');const delta=Number(x.delta);if(!Number.isFinite(delta)||delta===0)throw new ApplicationContractError('INVALID_ADJUSTMENT');return {...x,productId:requiredString(x.productId,'PRODUCT_ID_REQUIRED'),delta,operationId:operationId(x.operationId)};}
function addExpenseCommand(input){const x=object(input,'INVALID_EXPENSE_COMMAND');return {...x,operationId:operationId(x.operationId),amount:positiveNumber(x.amount,'INVALID_EXPENSE_AMOUNT')};}
function deleteExpenseCommand(input){const x=object(input,'INVALID_DELETE_EXPENSE_COMMAND');return {id:requiredString(x.id,'EXPENSE_ID_REQUIRED'),operationId:operationId(x.operationId)};}

function upsertProductsCommand(input){const x=object(input,'INVALID_UPSERT_PRODUCTS_COMMAND');if(!Array.isArray(x.products)||!x.products.length)throw new ApplicationContractError('PRODUCTS_REQUIRED');return {products:x.products};}
function deleteProductsCommand(input){const x=object(input,'INVALID_DELETE_PRODUCTS_COMMAND');if(!Array.isArray(x.productIds)||!x.productIds.length)throw new ApplicationContractError('PRODUCT_IDS_REQUIRED');return {productIds:x.productIds.map(id=>requiredString(id,'PRODUCT_ID_REQUIRED'))};}
function addStaffCommand(input){return object(input,'INVALID_ADD_STAFF_COMMAND');}
function updateStaffCommand(input){const x=object(input,'INVALID_UPDATE_STAFF_COMMAND');return {staffId:requiredString(x.staffId,'STAFF_ID_REQUIRED'),data:object(x.data,'STAFF_DATA_REQUIRED')};}
function deleteStaffCommand(input){const x=object(input,'INVALID_DELETE_STAFF_COMMAND');return {staffId:requiredString(x.staffId,'STAFF_ID_REQUIRED'),actorName:optionalString(x.actorName)};}
function addSupplierCommand(input){return object(input,'INVALID_ADD_SUPPLIER_COMMAND');}
function deleteSupplierCommand(input){const x=object(input,'INVALID_DELETE_SUPPLIER_COMMAND');return {supplierId:requiredString(x.supplierId,'SUPPLIER_ID_REQUIRED')};}
function recordSupplyCommand(input){const x=object(input,'INVALID_RECORD_SUPPLY_COMMAND');return {supplierId:requiredString(x.supplierId,'SUPPLIER_ID_REQUIRED'),amount:positiveNumber(x.amount,'INVALID_SUPPLY_AMOUNT')};}
function recordSupplierPaymentCommand(input){const x=object(input,'INVALID_SUPPLIER_PAYMENT_COMMAND');return {supplierId:requiredString(x.supplierId,'SUPPLIER_ID_REQUIRED'),amount:positiveNumber(x.amount,'INVALID_PAYMENT_AMOUNT'),paymentMethod:optionalString(x.paymentMethod)||'cash'};}
function editSaleCommand(input){const x=object(input,'INVALID_EDIT_SALE_COMMAND');return {saleId:requiredString(x.saleId,'SALE_ID_REQUIRED'),data:object(x.data,'SALE_DATA_REQUIRED')};}
function deleteSaleCommand(input){const x=object(input,'INVALID_DELETE_SALE_COMMAND');return {saleId:requiredString(x.saleId,'SALE_ID_REQUIRED'),actorName:optionalString(x.actorName),reason:optionalString(x.reason)};}
function createOrderCommand(input){return object(input,'INVALID_CREATE_ORDER_COMMAND');}
function orderIdCommand(input){const x=object(input,'INVALID_ORDER_COMMAND');return {orderId:requiredString(x.orderId,'ORDER_ID_REQUIRED')};}
function appendActivityLogCommand(input){const x=object(input,'INVALID_ACTIVITY_LOG_COMMAND');return {entry:object(x.entry,'ACTIVITY_ENTRY_REQUIRED')};}
function appendCrashLogCommand(input){const x=object(input,'INVALID_CRASH_LOG_COMMAND');return {entry:object(x.entry,'CRASH_ENTRY_REQUIRED')};}
function clearCrashLogCommand(){return {}; }

function salesPageQuery(input={}){const x=object(input||{},'INVALID_SALES_PAGE_QUERY');return {page:Math.max(1,Number(x.page)||1),pageSize:Math.min(100,Math.max(1,Number(x.pageSize)||24)),search:String(x.search||'').trim()};}
function dashboardQuery(input={}){return object(input||{},'INVALID_DASHBOARD_QUERY');}
module.exports={ApplicationContractError,upsertProductsCommand,deleteProductsCommand,addStaffCommand,updateStaffCommand,deleteStaffCommand,addSupplierCommand,deleteSupplierCommand,recordSupplyCommand,recordSupplierPaymentCommand,editSaleCommand,deleteSaleCommand,createOrderCommand,orderIdCommand,appendActivityLogCommand,appendCrashLogCommand,clearCrashLogCommand,completeSaleCommand,completeCartSaleCommand,completeCreditSaleCommand,addStockCommand,completeRestockCartCommand,recordCreditPaymentCommand,deleteCreditSaleCommand,adjustInventoryCommand,addExpenseCommand,deleteExpenseCommand,salesPageQuery,dashboardQuery};
