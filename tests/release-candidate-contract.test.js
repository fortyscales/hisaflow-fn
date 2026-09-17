const fs = require('fs');
const assert = require('assert');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const migrations = fs.readFileSync('electron/migrations.js','utf8');
const acceptance = fs.readFileSync('docs/FINANCIAL_ACCEPTANCE.md','utf8');
const rc = fs.readFileSync('docs/RELEASE_CANDIDATE.md','utf8');

assert.equal(pkg.version, '2.2.0');
assert.equal(pkg.author, 'HisaFlow');
assert(pkg.scripts['test:release-candidate'], 'release-candidate gate script missing');
for (const term of ['Dashboard All Time','PDF and Excel','quotation → proforma','native SQLite backup','release blocker']) {
  assert(rc.includes(term), `RC checklist missing: ${term}`);
}
for (const value of ['14,400','11,000','2,900','1,944','2,600','5 units']) {
  assert(acceptance.includes(value), `locked financial acceptance value missing: ${value}`);
}
assert(migrations.includes('version: 16'), 'expected schema migration 16');
assert(migrations.includes('normalizeLegacySyncOutbox'), 'real legacy outbox compatibility must remain');
assert(migrations.includes('normalizeLegacyInvoices'), 'real legacy invoice compatibility must remain');

const pkgBuild = pkg.build || {};
assert.equal(pkgBuild.appId, 'com.fortyscales.hisaflowdesktop', 'stable appId required for upgrades');
assert.equal(pkgBuild.productName, 'HisaFlow', 'stable productName required for upgrades');
console.log('v2.2.0 release-candidate contract passed.');
