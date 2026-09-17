function createTransactionRunner(db) {
  return { run(work) { return db.transaction(work)(); }, wrap(work) { return db.transaction(work); } };
}
module.exports = { createTransactionRunner };
