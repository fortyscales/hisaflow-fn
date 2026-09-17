const fs=require('fs'); const path=require('path'); const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'); const must=(c,m)=>{if(!c)throw new Error(m)};
const pkg=JSON.parse(read('package.json')); must(pkg.version==='2.2.8','version must be 2.2.8');
const reports=read('src/screens/ReportsScreen.jsx'); must(reports.includes("useState('today')"),'reports must default to today'); must(reports.includes('All accounts'),'reports need account filter'); must(reports.includes("type==='sales'")&&reports.includes("type==='expenses'"),'account filtering must be limited to applicable reports');
const q=read('electron/queries.js'); must(q.includes('accountId:e.account_id || null'),'expense report query must expose account id');
const header=read('src/components/ScreenHeader.jsx'); must(header.includes('position: "sticky"'),'shared header must remain sticky');
const css=read('src/styles/theme.css'); must(css.includes('v2.2.4 desktop release-candidate polish'),'global polish layer missing');
const loading=read('src/components/LoadingState.jsx'); must(loading.includes('Loading…'),'loading state should explain itself');
console.log('Desktop polish RC contract passed.');
