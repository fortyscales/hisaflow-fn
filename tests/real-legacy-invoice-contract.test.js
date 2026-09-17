const fs = require('fs');
const path = require('path');
const assert = require('assert');

const migrations = fs.readFileSync(path.join(__dirname, '..', 'electron', 'migrations.js'), 'utf8');

assert(migrations.includes('function normalizeLegacyInvoices(db)'), 'legacy invoice normalizer must exist');
assert(migrations.includes("const invoicesExists = db.prepare(\"SELECT 1 FROM sqlite_master WHERE type='table' AND name='invoices'\").get()"), 'runMigrations must detect legacy invoices');
assert(migrations.includes('db.transaction(() => normalizeLegacyInvoices(db))();'), 'legacy invoice normalization must run transactionally before pending migrations');
const runBody = migrations.slice(migrations.indexOf('function runMigrations(db)'));
assert(runBody.indexOf('db.transaction(() => normalizeLegacyInvoices(db))();') < runBody.indexOf('for (const migration of'), 'legacy invoice normalization must execute before pending migrations are applied');
assert(migrations.includes('credit_sale_id TEXT UNIQUE REFERENCES credit_sales(id) ON DELETE SET NULL'), 'canonical invoices must permit cash/B2B invoices without credit_sale_id');
assert(migrations.includes("COALESCE((SELECT cs.total_amount FROM credit_sales cs WHERE cs.id=i.credit_sale_id),0)"), 'legacy invoice total must be recovered from its credit sale');
assert(migrations.includes('SET amount_paid = COALESCE((SELECT cs.amount_paid FROM credit_sales cs WHERE cs.id=invoices.credit_sale_id), amount_paid)'), 'legacy settlement amount must be recovered from credit sale');
assert(migrations.includes('CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date DESC, invoice_number DESC)'), 'issue_date index remains after compatibility normalization');

console.log('Real legacy invoice migration contract passed.');
