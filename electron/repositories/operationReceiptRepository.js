function createOperationReceiptRepository(db) {
  const get = db.prepare('SELECT command_type, request_hash, response_json FROM operation_receipts WHERE operation_id = ?');
  const insert = db.prepare(`INSERT INTO operation_receipts(operation_id, command_type, request_hash, response_json, created_at)
    VALUES (?, ?, ?, ?, ?)`);
  return {
    find(operationId) { return get.get(operationId) || null; },
    save({ operationId, commandType, requestHash, response, createdAt }) {
      insert.run(operationId, commandType, requestHash, JSON.stringify(response), createdAt);
    },
  };
}
module.exports = { createOperationReceiptRepository };
