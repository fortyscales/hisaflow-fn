const assert = require('assert');
const { requestHash } = require('../electron/domain/salesService');

const a = { productId: 'p1', quantity: 2, sellingPrice: 1000, meta: { actorName: 'A', paymentMethod: 'cash' } };
const b = { sellingPrice: 1000, quantity: 2, meta: { paymentMethod: 'cash', actorName: 'A' }, productId: 'p1' };
const c = { ...a, quantity: 3 };
assert.strictEqual(requestHash(a), requestHash(b), 'key order must not change command identity');
assert.notStrictEqual(requestHash(a), requestHash(c), 'meaningfully different command must have a different hash');
console.log('sales idempotency contract: OK');
