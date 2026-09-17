function createExpenseRepository(db) {
  const insert = db.prepare(`INSERT INTO expenditures(id, description, amount, type, date, updated_at, version, account_id, account_label, account_number)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`);
  const find = db.prepare('SELECT id, description, amount, type, date, account_id, account_label, account_number FROM expenditures WHERE id=?');
  const del = db.prepare('DELETE FROM expenditures WHERE id=?');
  return {
    insert(row) { insert.run(row.id,row.description,row.amount,row.type,row.date,row.date,row.accountId||null,row.accountLabel||null,row.accountNumber||null); return row; },
    findById(id) { return find.get(id) || null; },
    deleteById(id) { return del.run(id).changes > 0; },
  };
}
module.exports = { createExpenseRepository };
