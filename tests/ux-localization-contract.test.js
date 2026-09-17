const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..'); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const stickyScreens=['ActivityLogScreen.jsx','StaffScreen.jsx','SuppliersScreen.jsx','ProductsScreen.jsx','CustomersScreen.jsx','CreditScreen.jsx','ordersScreen.jsx'];
for(const f of stickyScreens){const s=read('src/screens/'+f);assert(s.includes('StickyScreenChrome'),f+' must use pinned chrome');assert(s.includes('SearchInput')||f==='ProductsScreen.jsx',f+' must retain search');}
const chrome=read('src/components/StickyScreenChrome.jsx');assert(chrome.includes('top: -inset'));assert(chrome.includes('marginTop: -inset'));
const tr=read('src/i18n/translations.js');for(const k of ['accountsTitle','reportsTitle','paidFromAccountLabel','receivedIntoAccountLabel','paidCreditBadge']){assert((tr.match(new RegExp(k+':','g'))||[]).length===2,k+' must exist in sw and en');}
for(const f of ['AccountsScreen.jsx','ReportsScreen.jsx','DocumentsScreen.jsx']) assert(read('src/screens/'+f).includes('useLanguage'),f+' must be language aware');
console.log('PASS ux/localization contract');