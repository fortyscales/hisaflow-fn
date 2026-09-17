const fs=require('fs'); const path=require('path');
const root=path.join(__dirname,'..'); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
const sales=read('src/screens/SalesScreen.jsx');
ok(!sales.includes('{totalSales > 0 && ('),'Sales search must not disappear when result count is zero');
ok(sales.includes('clearSearchBtn'),'Sales search must offer a clear action');
const q=read('electron/queries.js');
ok(q.includes("'credit' AS record_type"),'Sales history must include paid credit sales');
ok(q.includes("cs.status = 'paid' OR cs.amount_paid >= cs.total_amount"),'Only settled credits belong in paid sales history');
const dash=read('src/screens/DashboardScreen.jsx'); ok(dash.includes('useState("today")'),'Dashboard must default to Today');
const form=read('src/components/ProductFormModal.jsx');
ok(form.includes('supplierAccountId') && form.includes('onAccountChange'),'Initial product stock must allow a configured payment account');
const batch=read('src/services/batchService.js'); ok(batch.includes('accountLabel: meta.accountLabel'),'Initial batch must preserve payment account metadata');
const header=read('src/components/ScreenHeader.jsx'); ok(header.includes('position: "sticky"'),'Shared screen headers must be sticky');
console.log('Desktop UX/accounts RC contract passed.');
