function createSaleRepository(db) {
  const insert = db.prepare(`INSERT INTO sales (id, product_id, product_name, quantity, buying_price, selling_price, total_cost, total_revenue, profit,
    payment_method, account_id, account_label, account_number, notes, date, batch_breakdown, customer_phone, customer_name,
    discount, product_category, product_brand, product_unit, product_image_uri, product_size, actor_name, updated_at, version)
    VALUES (@id, @productId, @productName, @quantity, @buyingPrice, @sellingPrice, @totalCost, @totalRevenue, @profit,
    @paymentMethod, @accountId, @accountLabel, @accountNumber, '', @date, @breakdownJson, @customerPhone, @customerName,
    @discount, @productCategory, @productBrand, @productUnit, @productImageUri, @productSize, @actorName, @date, 1)`);
  return { insert(sale) { insert.run({...sale, breakdownJson: JSON.stringify(sale.batchBreakdown)}); return sale; } };
}
module.exports = { createSaleRepository };
