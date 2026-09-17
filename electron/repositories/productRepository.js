/** SQLite product repository. Business services depend on this small surface
 * rather than on ad-hoc SELECT * calls. A PostgreSQL repository can implement
 * the same contract later behind NestJS. */
function createProductRepository(db) {
  const byId = db.prepare(`SELECT id, name, category, brand, size, unit,
    selling_price, buying_price, stock, image_uri, expiry_date, created_at,
    updated_at, version FROM products WHERE id = ?`);
  const stockById = db.prepare("SELECT id, name, stock FROM products WHERE id = ?");
  return {
    findById(id) { return byId.get(id) || null; },
    findStockById(id) { return stockById.get(id) || null; },
    exists(id) { return Boolean(stockById.get(id)); },
  };
}
module.exports = { createProductRepository };
