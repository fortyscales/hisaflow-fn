const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..'); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const mig=read('electron/migrations.js'), q=read('electron/queries.js'), pre=read('electron/preload.js'), ui=read('src/screens/DocumentsScreen.jsx');
assert(mig.includes("version: 13")&&mig.includes('commercial_documents')&&mig.includes('commercial_document_items'));
assert(q.includes('createCommercialDocumentTx')&&q.includes('convertQuotationToProforma'));
assert(pre.includes('commercialDocuments:create')&&pre.includes('commercialDocuments:convertToProforma'));
assert(ui.includes('B2B Documents')&&ui.includes('Convert to Proforma')&&ui.includes('Export PDF'));
console.log('B2B documents contract PASS');
