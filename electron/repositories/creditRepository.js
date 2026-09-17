function createCreditRepository(db) {
  const insertSale=db.prepare(`INSERT INTO credit_sales(id,customer_name,customer_phone,total_amount,amount_paid,status,date,actor_name,updated_at,version) VALUES (?,?,?,?,0,'pending',?,?,?,1)`);
  const insertItem=db.prepare(`INSERT INTO credit_sale_items(id,credit_sale_id,product_id,product_name,quantity,selling_price,cost_at_sale,batch_breakdown,product_category,product_brand,product_unit,product_image_uri,product_size,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  const find=db.prepare('SELECT * FROM credit_sales WHERE id=?');
  const items=db.prepare('SELECT * FROM credit_sale_items WHERE credit_sale_id=?');
  const updatePayment=db.prepare('UPDATE credit_sales SET amount_paid=?,status=?,updated_at=?,version=version+1 WHERE id=?');
  const insertPayment=db.prepare(`INSERT INTO credit_sale_payments(id,credit_sale_id,amount,payment_method,date,updated_at,version,account_id,account_label,account_number) VALUES (?,?,?,?,?,?,1,?,?,?)`);
  const del=db.prepare('DELETE FROM credit_sales WHERE id=?');
  return {
    insertSale(s){insertSale.run(s.id,s.customerName,s.customerPhone,s.totalAmount,s.date,s.actorName||null,s.date);},
    insertItem(i){insertItem.run(i.id,i.creditSaleId,i.productId,i.productName,i.quantity,i.sellingPrice,i.costAtSale,JSON.stringify(i.batchBreakdown||[]),i.productCategory||null,i.productBrand||null,i.productUnit||null,i.productImageUri||null,i.productSize||null,i.date);},
    findById(id){return find.get(id)||null;}, listItems(id){return items.all(id);},
    updatePaymentState(id, amountPaid, status, date){updatePayment.run(amountPaid,status,date,id);},
    insertPayment(p){insertPayment.run(p.id,p.creditSaleId,p.amount,p.paymentMethod||'',p.date,p.date,p.accountId||null,p.accountLabel||null,p.accountNumber||null);},
    deleteById(id){return del.run(id).changes>0;},
  };
}
module.exports={createCreditRepository};
