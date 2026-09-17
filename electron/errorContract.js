const SAFE_CODES = new Set([
  'INVALID_EXPENSE_AMOUNT','EXPENSE_DESCRIPTION_REQUIRED','EMPTY_CREDIT_CART','CUSTOMER_REQUIRED',
  'ORDER_NOT_FOUND','ORDER_CLOSED','INVALID_CREDIT_QUANTITY','INVALID_CREDIT_PRICE','PRODUCT_NOT_FOUND',
  'INSUFFICIENT_STOCK','INVALID_PAYMENT_AMOUNT','CREDIT_NOT_FOUND','PAYMENT_EXCEEDS_BALANCE',
  'INVALID_PURCHASE_QUANTITY','INVALID_PURCHASE_PRICE','EMPTY_PURCHASE_CART','INVALID_ADJUSTMENT',
  'IDEMPOTENCY_CONFLICT','UNKNOWN_APPLICATION_COMMAND','UNKNOWN_APPLICATION_QUERY','DATABASE_BUSY',
  'DATABASE_LOCKED','DATABASE_INTEGRITY_FAILED','BACKUP_INVALID','BACKUP_SCHEMA_NEWER','UNEXPECTED_ERROR'
]);
function codeFrom(error){
  const raw=String(error?.code || error?.message || 'UNEXPECTED_ERROR').split(':')[0];
  if(raw==='SQLITE_BUSY') return 'DATABASE_BUSY';
  if(raw==='SQLITE_LOCKED') return 'DATABASE_LOCKED';
  return SAFE_CODES.has(raw) ? raw : 'UNEXPECTED_ERROR';
}
function serializeError(error, context={}){
  const code=codeFrom(error);
  const details={};
  for(const key of ['available','remaining','productName']) if(error && error[key] !== undefined) details[key]=error[key];
  return { ok:false, error:{ code, retryable: code==='DATABASE_BUSY'||code==='DATABASE_LOCKED', details, context } };
}
async function invokeSafely(fn, context={}){
  try { return { ok:true, data: await fn() }; }
  catch(error){ console.error('HisaFlow operation failed', { ...context, code:codeFrom(error), message:error?.message }); return serializeError(error,context); }
}
module.exports={codeFrom,serializeError,invokeSafely};
