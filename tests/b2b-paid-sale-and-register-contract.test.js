
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const m=read('electron/migrations.js'),q=read('electron/queries.js'),pre=read('electron/preload.js'),main=read('electron/main.js'),ui=read('src/screens/DocumentsScreen.jsx');
assert.match(m,/version:\s*15/); assert.match(m,/converted_sale_ids/); assert.match(m,/idx_invoices_source_document_unique/);
assert.match(q,/convertProformaToSale/); assert.match(q,/completeCartSale/); assert.match(q,/converted_sale_ids/); assert.match(q,/credit_sale_payments/); assert.match(q,/overdue/);
assert.match(pre,/convertProformaToSale/); assert.match(main,/commercialDocuments:convertToSale/);
assert.match(ui,/Paid Sale \+ Invoice/); assert.match(ui,/Payment history/); assert.match(ui,/HisaFlow-Invoices/); assert.match(ui,/XLSX/);
console.log('b2b paid-sale and invoice-register contract passed');
