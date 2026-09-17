/** Inventory business rules. v1.4: no SQL/database adapter knowledge lives here. */
function createInventoryService(repository, products, DomainError=Error) {
  function context(options,fallback){return{movementType:options.movementType||fallback,referenceType:options.referenceType||null,referenceId:options.referenceId||null,actorName:options.actorName||null,metadata:options.metadata||null};}
  function recomputeProductSummary(productId,now=new Date().toISOString()){
    const row=repository.getSummary(productId); const stock=Number(row.stock||0); const buyingPrice=stock>0?Number(row.value||0)/stock:0;
    repository.updateProductProjection(productId,stock,buyingPrice,now); return{stock,buyingPrice};
  }
  function consumeFIFO(productId,quantity,options={}){
    const requested=Number(quantity); if(!Number.isFinite(requested)||requested<=0)throw new DomainError('INVALID_QUANTITY');
    const batches=repository.listFifoBatches(productId), available=batches.reduce((s,b)=>s+Number(b.remaining),0);
    if(requested>available+1e-9){const e=new DomainError('INSUFFICIENT_STOCK');e.available=available;e.requested=requested;throw e;}
    const now=options.now||new Date().toISOString(); let left=requested,totalCost=0; const breakdown=[];
    for(const b of batches){if(left<=1e-9)break;const take=Math.min(Number(b.remaining),left);if(take<=0)continue;totalCost+=take*Number(b.buying_price);left-=take;
      breakdown.push({batchId:b.id,quantity:take,buyingPrice:Number(b.buying_price),date:b.date,supplierId:b.supplier_id||null,supplierName:b.supplier_name||null,paymentMethod:b.payment_method||null,accountId:b.account_id||null,accountLabel:b.account_label||null,accountNumber:b.account_number||null});
      repository.setMovementContext(b.id,context(options,'SALE'),now); repository.setBatchRemaining(b.id,Number(b.remaining)-take,now);
    }
    if(left>1e-7)throw new DomainError('INVENTORY_CONSUMPTION_MISMATCH'); recomputeProductSummary(productId,now);
    return{totalCost,breakdown,effectiveBuyingPrice:totalCost/requested,quantity:requested};
  }
  function restoreConsumption({productId,breakdown,totalQuantity,fallbackBuyingPrice=0,fallbackDate,idFactory,now=new Date().toISOString(),movementType='RETURN',referenceType=null,referenceId=null,actorName=null,metadata=null}){
    if(typeof idFactory!=='function')throw new Error('idFactory is required');
    const restoreEntry=(entry)=>{const qty=Number(entry.quantity||0);if(!(qty>0))return;const ctx={movementType,referenceType,referenceId,actorName,metadata};
      if(entry.batchId){const existing=repository.findBatch(entry.batchId,productId);if(existing){if(Number(existing.remaining)+qty>Number(existing.quantity)+1e-9)throw new DomainError('BATCH_RESTORE_OVERFLOW');repository.setMovementContext(entry.batchId,ctx,now);repository.restoreBatch(entry.batchId,qty,now);return;}}
      const id=entry.batchId||idFactory('b'),date=entry.date||fallbackDate||now;repository.setMovementContext(id,ctx,now);repository.insertBatch({id,productId,quantity:qty,remaining:qty,buyingPrice:Number(entry.buyingPrice??fallbackBuyingPrice??0),date,supplierId:entry.supplierId,supplierName:entry.supplierName,paymentMethod:entry.paymentMethod,accountId:entry.accountId,accountLabel:entry.accountLabel,accountNumber:entry.accountNumber,updatedAt:now});
    };
    if(Array.isArray(breakdown)&&breakdown.length)breakdown.forEach(restoreEntry);else restoreEntry({quantity:Number(totalQuantity||0),buyingPrice:Number(fallbackBuyingPrice||0),date:fallbackDate||now});
    return recomputeProductSummary(productId,now);
  }
  function receiveStock({batchId,productId,quantity,buyingPrice,date=new Date().toISOString(),supplierId=null,supplierName=null,paymentMethod=null,accountId=null,accountLabel=null,accountNumber=null,movementType='PURCHASE',referenceType='purchase',referenceId=null,actorName=null,metadata=null}){
    const qty=Number(quantity),cost=Number(buyingPrice);if(!batchId)throw new DomainError('BATCH_ID_REQUIRED');if(!(qty>0))throw new DomainError('INVALID_QUANTITY');if(!Number.isFinite(cost)||cost<0)throw new DomainError('INVALID_BUYING_PRICE');
    repository.setMovementContext(batchId,{movementType,referenceType,referenceId,actorName,metadata},date);
    try{repository.insertBatch({id:batchId,productId,quantity:qty,remaining:qty,buyingPrice:cost,date,supplierId,supplierName,paymentMethod,accountId,accountLabel,accountNumber,updatedAt:date});}catch(e){repository.clearMovementContext(batchId);throw e;}
    return recomputeProductSummary(productId,date);
  }
  function adjustStock({productId,delta,reason='manual adjustment',actorName=null,idFactory,now=new Date().toISOString()}){
    const amount=Number(delta);if(!Number.isFinite(amount)||Math.abs(amount)<1e-9)throw new DomainError('INVALID_ADJUSTMENT');if(typeof idFactory!=='function')throw new Error('idFactory is required');const referenceId=idFactory('adj');
    if(amount>0){const p=products.findById(productId);if(!p)throw new DomainError('PRODUCT_NOT_FOUND');receiveStock({batchId:idFactory('b'),productId,quantity:amount,buyingPrice:Number(p.buying_price||0),date:now,movementType:'ADJUSTMENT_IN',referenceType:'inventory_adjustment',referenceId,actorName,metadata:{reason}});}else consumeFIFO(productId,Math.abs(amount),{now,movementType:'ADJUSTMENT_OUT',referenceType:'inventory_adjustment',referenceId,actorName,metadata:{reason}});
    return{referenceId,...recomputeProductSummary(productId,now)};
  }
  function getMovementHistory(productId,{limit=100,offset=0}={}){const l=Math.min(500,Math.max(1,Number(limit)||100)),o=Math.max(0,Number(offset)||0);return repository.listMovements(productId,l,o).map(r=>({...r,metadata:r.metadata?JSON.parse(r.metadata):null}));}
  function assertProjection(productId){const c=repository.getSummary(productId),p=products.findById(productId);if(!p)throw new DomainError('PRODUCT_NOT_FOUND');const stock=Number(c.stock||0),buyingPrice=stock>0?Number(c.value||0)/stock:0;return{valid:Math.abs(Number(p.stock)-stock)<1e-7&&Math.abs(Number(p.buying_price)-buyingPrice)<1e-7,expected:{stock,buyingPrice},actual:{stock:Number(p.stock),buyingPrice:Number(p.buying_price)}};}
  return{recomputeProductSummary,consumeFIFO,restoreConsumption,receiveStock,adjustStock,getMovementHistory,assertProjection};
}
module.exports={createInventoryService};
