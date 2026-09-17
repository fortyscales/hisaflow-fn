const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function must(ok,msg){if(!ok)throw new Error(msg);}
const mig=read('electron/migrations.js'), main=read('electron/main.js'), preload=read('electron/preload.js'), reports=read('src/screens/ReportsScreen.jsx'), dash=read('src/screens/DashboardScreen.jsx'), credit=read('src/screens/CreditScreen.jsx');
must(/version:\s*11/.test(mig)&&mig.includes('CREATE TABLE IF NOT EXISTS invoices')&&mig.includes('CREATE TABLE IF NOT EXISTS invoice_items'),'invoice migration missing');
must(main.includes('documents:exportPdf')&&main.includes('webContents.printToPDF'),'native PDF export missing');
must(preload.includes('getReportData')&&preload.includes('createInvoice'),'finance IPC missing');
must(['sales','expenses','stock','credits'].every(x=>reports.includes(`${x}:`)),'report types missing');
must(reports.includes('XLSX.writeFile')&&reports.includes("exportReport('pdf')"),'PDF/XLSX export missing');
must(dash.includes('useState("today")'),'dashboard must default to today while historical periods remain selectable');
must(credit.includes('InvoiceModal')&&credit.includes('Create / View Invoice'),'credit invoice entry point missing');
console.log('merchant finance contract: PASS');
