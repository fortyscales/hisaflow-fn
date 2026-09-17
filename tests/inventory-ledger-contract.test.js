const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const inventory = fs.readFileSync(path.join(root, 'electron/domain/inventoryService.js'), 'utf8');
const migrations = fs.readFileSync(path.join(root, 'electron/migrations.js'), 'utf8');
const integrity = fs.readFileSync(path.join(root, 'electron/integrity.js'), 'utf8');
const sales = fs.readFileSync(path.join(root, 'electron/domain/salesService.js'), 'utf8');

assert.match(migrations, /version:\s*7/);
assert.match(migrations, /MIGRATION_RECONCILIATION/);
assert.match(migrations, /stock_movement_context/);
assert.match(migrations, /trg_stock_movement_batch_remaining/);
assert.match(inventory, /function adjustStock/);
assert.match(inventory, /ADJUSTMENT_IN/);
assert.match(inventory, /ADJUSTMENT_OUT/);
assert.match(inventory, /function getMovementHistory/);
assert.match(integrity, /ledgerMismatches/);
assert.match(integrity, /getInventoryReconciliationReport/);
assert.match(sales, /referenceType: 'sale'/);
assert.match(sales, /referenceId: saleId/);
console.log('inventory ledger contract: PASS');
