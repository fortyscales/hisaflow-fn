const assert = require('assert');
const { createSalesService } = require('../electron/domain/salesService');
const { createPurchaseService } = require('../electron/domain/purchaseService');
const { createCreditService } = require('../electron/domain/creditService');

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function makeState(){ return { stock:{p1:10}, sales:[], activities:[], receipts:{}, credits:{c1:{id:'c1',customer_name:'Asha',total_amount:1000,amount_paid:200,status:'partial'}}, payments:[], batches:[] }; }
function makeHarness(initial=makeState()){
  let state=clone(initial); let seq=0;
  const tx={ run(work){ const before=clone(state); try{return work();}catch(e){state=before; throw e;} } };
  const receipts={find(id){return state.receipts[id]||null;},save(r){state.receipts[r.operationId]={command_type:r.commandType,request_hash:r.requestHash,response_json:JSON.stringify(r.response)};}};
  const repos={
    receipts,
    products:{findById(id){return id==='p1'?{id:'p1',name:'Sukari',stock:state.stock.p1,buying_price:500,category:'Food',unit:'kg'}:null;}},
    sales:{insert(s){ if (repos.sales.fail) throw new Error('INJECTED_SALE_INSERT_FAILURE'); state.sales.push(clone(s)); }},
    activities:{append(a){ if(repos.activities.fail) throw new Error('INJECTED_ACTIVITY_FAILURE'); state.activities.push(clone(a)); }},
    orders:{findStatus(){return null;},markFulfilled(){}},
    credit:{
      findById(id){return state.credits[id]||null;},
      updatePaymentState(id,paid,status){state.credits[id].amount_paid=paid;state.credits[id].status=status;},
      insertPayment(p){if(repos.credit.failPayment)throw new Error('INJECTED_PAYMENT_INSERT_FAILURE');state.payments.push(clone(p));},
      insertSale(){},insertItem(){},listItems(){return[];},deleteById(){}
    }
  };
  const inventory={
    consumeFIFO(id,q){ if(state.stock[id]<q){const e=new Error('INSUFFICIENT_STOCK');e.available=state.stock[id];throw e;} state.stock[id]-=q; return{totalCost:q*500,effectiveBuyingPrice:500,breakdown:[{batchId:'b0',quantity:q,buyingPrice:500}]};},
    receiveStock({productId,quantity,batchId}){state.stock[productId]+=Number(quantity);state.batches.push({batchId,quantity});},
    restoreConsumption(){}
  };
  const idFactory=(p)=>`${p}_${++seq}`;
  return {repos,inventory,tx,idFactory,getState:()=>clone(state)};
}

// A crash/failure after stock consumption but before the sale insert must roll back stock.
{
 const h=makeHarness(); h.repos.sales.fail=true;
 const svc=createSalesService({inventory:h.inventory,repositories:h.repos,transactionRunner:h.tx,idFactory:h.idFactory,clock:()=> '2026-09-16T12:00:00.000Z'});
 assert.throws(()=>svc.completeSingleTx({operationId:'op-sale-fail',productId:'p1',productName:'Sukari',quantity:2,sellingPrice:800}),/INJECTED_SALE_INSERT_FAILURE/);
 const s=h.getState(); assert.equal(s.stock.p1,10); assert.equal(s.sales.length,0); assert.equal(Object.keys(s.receipts).length,0);
}

// A crash/failure after stock receipt but before activity/receipt commit must roll back the restock.
{
 const h=makeHarness(); h.repos.activities.fail=true;
 const svc=createPurchaseService({inventory:h.inventory,repositories:h.repos,transactionRunner:h.tx,idFactory:h.idFactory,clock:()=> '2026-09-16T12:00:00.000Z'});
 assert.throws(()=>svc.addTx({operationId:'op-buy-fail',productId:'p1',quantity:5,buyingPrice:450}),/INJECTED_ACTIVITY_FAILURE/);
 const s=h.getState(); assert.equal(s.stock.p1,10); assert.equal(s.batches.length,0); assert.equal(Object.keys(s.receipts).length,0);
}

// Credit balance update and payment insert are one unit: injected payment failure rolls balance back.
{
 const h=makeHarness(); h.repos.credit.failPayment=true;
 const svc=createCreditService({inventory:h.inventory,repositories:h.repos,transactionRunner:h.tx,idFactory:h.idFactory,clock:()=> '2026-09-16T12:00:00.000Z'});
 assert.throws(()=>svc.paymentTx({operationId:'op-credit-fail',creditSaleId:'c1',amount:300,paymentMethod:'cash'}),/INJECTED_PAYMENT_INSERT_FAILURE/);
 const s=h.getState(); assert.equal(s.credits.c1.amount_paid,200); assert.equal(s.credits.c1.status,'partial'); assert.equal(s.payments.length,0); assert.equal(Object.keys(s.receipts).length,0);
}

// Same successful operation ID is replay-safe; stock and sale are mutated exactly once.
{
 const h=makeHarness();
 const svc=createSalesService({inventory:h.inventory,repositories:h.repos,transactionRunner:h.tx,idFactory:h.idFactory,clock:()=> '2026-09-16T12:00:00.000Z'});
 const req={operationId:'op-once',productId:'p1',productName:'Sukari',quantity:2,sellingPrice:800};
 const a=svc.completeSingleTx(req), b=svc.completeSingleTx(req);
 const s=h.getState(); assert.deepEqual(a,b); assert.equal(s.stock.p1,8); assert.equal(s.sales.length,1); assert.equal(Object.keys(s.receipts).length,1);
 assert.throws(()=>svc.completeSingleTx({...req,quantity:3}),/IDEMPOTENCY_CONFLICT/);
}
console.log('v1.8 failure injection tests passed');
