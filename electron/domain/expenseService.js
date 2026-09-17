const { createCommandGuard } = require('./commandGuard');
function createExpenseService({ repositories, transactionRunner, idFactory, clock = () => new Date().toISOString() }) {
  const guard = createCommandGuard(repositories.receipts);
  const workAdd = (request) => guard(request.operationId, 'expense.add', request, () => {
    const amount=Number(request.amount); if(!Number.isFinite(amount)||amount<=0) throw new Error('INVALID_EXPENSE_AMOUNT');
    const description=String(request.description||'').trim(); if(!description) throw new Error('EXPENSE_DESCRIPTION_REQUIRED');
    const date=request.date||clock(); const row={id:request.id||idFactory('exp'),description,amount,type:request.type||'',date,accountId:request.accountId||null,accountLabel:request.accountLabel||'',accountNumber:request.accountNumber||''};
    repositories.expenses.insert(row); repositories.accountLedger?.record({id:idFactory('alg'),accountId:row.accountId,accountLabel:row.accountLabel,accountNumber:row.accountNumber,direction:'out',amount,entryType:'expense',referenceType:'expense',referenceId:row.id,description,date});
    repositories.activities.append({id:idFactory('al'),action:'recorded expense',details:`${description} — TZS ${Math.round(amount).toLocaleString('en-US')}`,actorName:request.actorName||null,date});
    return row;
  });
  const workDelete=(request)=>guard(request.operationId,'expense.delete',request,()=>{ const row=repositories.expenses.findById(request.id); if(!row)return{deleted:false}; repositories.expenses.deleteById(request.id); const date=clock(); repositories.accountLedger?.record({id:idFactory('alg'),accountId:row.account_id||row.accountId,accountLabel:row.account_label||row.accountLabel,accountNumber:row.account_number||row.accountNumber,direction:'in',amount:Number(row.amount),entryType:'expense_reversal',referenceType:'expense',referenceId:row.id,description:`Reversal: ${row.description}`,date}); repositories.activities.append({id:idFactory('al'),action:'deleted expense',details:`Deleted ${row.description} — TZS ${Math.round(row.amount).toLocaleString('en-US')}`,actorName:request.actorName||null,date}); return{deleted:true}; });
  return { addTx:(request)=>transactionRunner.run(()=>workAdd(request)), deleteTx:(request)=>transactionRunner.run(()=>workDelete(request)) };
}
module.exports={createExpenseService};
