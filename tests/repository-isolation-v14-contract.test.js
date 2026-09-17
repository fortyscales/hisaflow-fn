const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
for(const f of ['inventoryService.js','creditService.js','purchaseService.js']){
 const s=fs.readFileSync(path.join(root,'electron/domain',f),'utf8');
 assert(!/\.prepare\s*\(/.test(s),`${f} must not prepare SQL`);
 assert(!/db\.transaction|db\.exec|db\.prepare/.test(s),`${f} must not depend on SQLite`);
}
for(const f of ['inventoryRepository.js','creditRepository.js'])assert(fs.existsSync(path.join(root,'electron/repositories',f)),`${f} missing`);
const q=fs.readFileSync(path.join(root,'electron/queries.js'),'utf8');
assert(q.includes('createInventoryService(repositories.inventory, repositories.products'));
assert(q.includes('createCreditService({ inventory, repositories, transactionRunner'));
assert(q.includes('createPurchaseService({ inventory, repositories, transactionRunner'));
console.log('v1.4 repository isolation contracts passed');
