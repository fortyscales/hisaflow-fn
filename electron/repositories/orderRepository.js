function createOrderRepository(db) {
  const status = db.prepare('SELECT status FROM orders WHERE id = ?');
  const fulfill = db.prepare("UPDATE orders SET status='fulfilled', fulfilled_at=?, updated_at=?, version=version+1 WHERE id=?");
  return {
    findStatus(id) { return status.get(id) || null; },
    markFulfilled(id, date) { return fulfill.run(date,date,id).changes > 0; },
  };
}
module.exports = { createOrderRepository };
