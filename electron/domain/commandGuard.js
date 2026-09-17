const crypto = require('crypto');

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function requestHash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}
function createCommandGuard(receipts) {
  // v1.3 accepts a repository contract. Keep a tiny compatibility adapter for older callers/tests.
  const repo = typeof receipts.prepare === 'function' ? {
    find(operationId) { return receipts.prepare('SELECT command_type, request_hash, response_json FROM operation_receipts WHERE operation_id=?').get(operationId) || null; },
    save({operationId,commandType,requestHash,response,createdAt}) { receipts.prepare(`INSERT INTO operation_receipts(operation_id, command_type, request_hash, response_json, created_at) VALUES (?, ?, ?, ?, ?)`).run(operationId,commandType,requestHash,JSON.stringify(response),createdAt); },
  } : receipts;
  return function idempotent(operationId, commandType, request, work) {
    if (!operationId) return work();
    const hash = requestHash(request);
    const existing = repo.find(operationId);
    if (existing) {
      if (existing.command_type !== commandType || existing.request_hash !== hash) {
        const err = new Error('IDEMPOTENCY_CONFLICT'); err.code = 'IDEMPOTENCY_CONFLICT'; throw err;
      }
      return JSON.parse(existing.response_json);
    }
    const result = work();
    repo.save({ operationId, commandType, requestHash: hash, response: result, createdAt: new Date().toISOString() });
    return result;
  };
}
module.exports = { createCommandGuard, requestHash, stableStringify };
