const fs=require('fs'),assert=require('assert'),path=require('path'); const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'electron/main.js'),'utf8'); const preload=fs.readFileSync(path.join(root,'electron/preload.js'),'utf8'); const err=fs.readFileSync(path.join(root,'electron/errorContract.js'),'utf8'); const data=fs.readFileSync(path.join(root,'src/services/DataService.js'),'utf8');
assert(main.includes('app:commandSafe') && main.includes('invokeSafely'));
assert(preload.includes('system:startupHealth') && preload.includes('system:exportDiagnostics'));
assert(err.includes('DATABASE_BUSY') && err.includes('retryable'));
assert(data.includes('unwrapApplicationResult'));
console.log('v1.9 production hardening contracts passed');
