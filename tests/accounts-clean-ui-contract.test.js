const fs = require('fs');
const p = fs.readFileSync('src/screens/AccountsScreen.jsx','utf8');
function ok(c,m){ if(!c) throw new Error(m); }
ok(p.includes('summaryItem'), 'account summary spacing missing');
ok(p.includes('transactionMeta'), 'transaction metadata spacing missing');
ok(!p.includes("String(x.referenceId).slice"), 'raw transaction id still rendered in Accounts UI');
ok(!p.includes("t('referenceIdLabel')"), 'raw transaction id still exported in account statement');
ok(p.includes('labelReference(x.referenceType)'), 'human-readable reference missing');
console.log('accounts clean UI contract: PASS');
