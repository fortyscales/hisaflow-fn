function createInventoryRepository(db) {
  const fifo = db.prepare(`SELECT id, product_id, quantity, remaining, buying_price, date, supplier_id, supplier_name, payment_method, account_id, account_label, account_number FROM stock_batches WHERE product_id=? AND remaining>0 ORDER BY date ASC, id ASC`);
  const setContext = db.prepare(`INSERT OR REPLACE INTO stock_movement_context(batch_id,movement_type,reference_type,reference_id,actor_name,metadata,created_at) VALUES (?,?,?,?,?,?,?)`);
  const clearContext = db.prepare('DELETE FROM stock_movement_context WHERE batch_id=?');
  const updateRemaining = db.prepare('UPDATE stock_batches SET remaining=?, updated_at=?, version=version+1 WHERE id=?');
  const summary = db.prepare(`SELECT COALESCE(SUM(remaining),0) stock, COALESCE(SUM(remaining*buying_price),0) value FROM stock_batches WHERE product_id=? AND remaining>0`);
  const updateProduct = db.prepare('UPDATE products SET stock=?, buying_price=?, updated_at=?, version=version+1 WHERE id=?');
  const batch = db.prepare('SELECT id, quantity, remaining FROM stock_batches WHERE id=? AND product_id=?');
  const restore = db.prepare('UPDATE stock_batches SET remaining=remaining+?, updated_at=?, version=version+1 WHERE id=?');
  const insertBatch = db.prepare(`INSERT INTO stock_batches(id,product_id,quantity,remaining,buying_price,date,supplier_id,supplier_name,payment_method,account_id,account_label,account_number,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  const movements = db.prepare(`SELECT id, product_id AS productId, batch_id AS batchId, movement_type AS movementType, quantity_delta AS quantityDelta, unit_cost AS unitCost, reference_type AS referenceType, reference_id AS referenceId, actor_name AS actorName, created_at AS createdAt, metadata FROM stock_movements WHERE product_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`);
  return {
    listFifoBatches(productId){ return fifo.all(productId); },
    setMovementContext(batchId, c, now){ setContext.run(batchId,c.movementType,c.referenceType||null,c.referenceId||null,c.actorName||null,c.metadata?JSON.stringify(c.metadata):null,now); },
    clearMovementContext(batchId){ clearContext.run(batchId); },
    setBatchRemaining(id, remaining, now){ updateRemaining.run(remaining,now,id); },
    getSummary(productId){ return summary.get(productId); },
    updateProductProjection(productId, stock, buyingPrice, now){ updateProduct.run(stock,buyingPrice,now,productId); },
    findBatch(id, productId){ return batch.get(id,productId)||null; },
    restoreBatch(id, quantity, now){ restore.run(quantity,now,id); },
    insertBatch(b){ insertBatch.run(b.id,b.productId,b.quantity,b.remaining,b.buyingPrice,b.date,b.supplierId||null,b.supplierName||null,b.paymentMethod||null,b.accountId||null,b.accountLabel||null,b.accountNumber||null,b.updatedAt||b.date); },
    listMovements(productId, limit, offset){ return movements.all(productId,limit,offset); },
  };
}
module.exports={createInventoryRepository};
