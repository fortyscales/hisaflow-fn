'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const preload=read('electron/preload.js');
const main=read('electron/main.js');
const data=read('src/services/DataService.js');
const crash=read('src/services/crashLogService.jsx');
const forbiddenWhole=['saveProducts','saveSales','saveCreditSales','saveExpenditures','saveSuppliers','saveStaff','saveActivityLog','saveCrashLog'];
for(const name of forbiddenWhole){
  assert(!preload.includes(`${name}:`), `preload must not expose ${name}`);
  assert(!data.includes(`${name}:`), `DataService must not expose ${name}`);
}
for(const channel of ['data:saveProducts','data:saveSales','data:saveCreditSales','data:saveExpenditures','data:saveSuppliers','data:saveStaff','data:saveActivityLog','data:saveCrashLog']){
  assert(!main.includes(channel), `main must not register ${channel}`);
}
for(const cmd of ['upsertProducts','deleteProducts','addStaff','updateStaff','deleteStaff','addSupplier','deleteSupplier','recordSupply','recordSupplierPayment','editSale','deleteSale','createOrder','fulfillOrder','cancelOrder','appendCrashLog','clearCrashLog']){
  assert(data.includes(`command("${cmd}"`), `DataService should route ${cmd} through app:command`);
}
assert(crash.includes('appendCrashLog(entry)'), 'crash logging must append one row');
assert(crash.includes('clearCrashLog()'), 'crash clear must use granular command');
assert(!crash.includes('saveCrashLog'), 'crash service must not rewrite whole crash table');
console.log('v1.6 legacy surface contract: PASS');
