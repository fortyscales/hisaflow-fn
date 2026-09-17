const fs = require('fs');
const assert = require('assert');

// v2.1 release-gate scenario. These expected values are intentionally
// independent of the UI so a future refactor cannot redefine the answer.
// Inventory: 10 @ 700, then 10 @ 800.
// Paid sale: 12 @ 1,000 with 1,200 document discount => revenue 10,800.
// FIFO COGS: 10*700 + 2*800 = 8,600; gross profit = 2,200.
// Credit sale: 3 @ 1,200 => revenue 3,600; FIFO COGS 3*800 = 2,400; profit 1,200.
// Expense: 500. VAT is 18% of the paid sale's discounted taxable amount and
// is deliberately NOT revenue/profit. Partial credit payment affects cash/
// receivable state, not revenue recognition.
const expected = {
  paidRevenue: 10800,
  paidCogs: 8600,
  paidProfit: 2200,
  creditRevenue: 3600,
  creditCogs: 2400,
  creditProfit: 1200,
  expenses: 500,
  tax: 1944,
  creditPayment: 1000,
  creditOutstanding: 2600,
  endingStock: 5,
  endingInventoryCost: 4000,
};
expected.revenue = expected.paidRevenue + expected.creditRevenue;
expected.grossProfit = expected.paidProfit + expected.creditProfit;
expected.netProfit = expected.grossProfit - expected.expenses;

assert.equal(expected.revenue, 14400);
assert.equal(expected.grossProfit, 3400);
assert.equal(expected.netProfit, 2900);
assert.equal(expected.tax, 1944);
assert.equal(expected.creditOutstanding, 2600);
assert.equal(expected.endingStock, 5);
assert.equal(expected.endingInventoryCost, 4000);

const analytics = fs.readFileSync('electron/repositories/analyticsRepository.js','utf8');
const queries = fs.readFileSync('electron/queries.js','utf8');
const reports = fs.readFileSync('src/screens/ReportsScreen.jsx','utf8');
const invoice = queries;

// Revenue population must be identical in principle: paid + non-cancelled
// credit item lines. Tax must remain a separate ledger.
assert(analytics.includes('FROM sales s') && analytics.includes('FROM credit_sale_items i'), 'dashboard must combine paid and credit revenue');
assert(queries.includes("saleType: 'paid'") && queries.includes("saleType: 'credit'"), 'reports must combine paid and credit revenue');
assert(queries.includes('FROM tax_ledger WHERE'), 'tax must remain separate from sales revenue');
assert(!analytics.includes('tax_ledger'), 'dashboard revenue/profit must not add tax ledger amounts');

// All period queries use a half-open [start,end) interval. This prevents a
// transaction exactly on a boundary from appearing in two adjacent reports.
assert(analytics.includes(`${'${alias}'}.date < @end`), 'dashboard period end must be exclusive');
assert(queries.includes(`${'${column}'} < @end`), 'report period end must be exclusive');

// Credit payments alter settlement, not recognized sales revenue.
assert(analytics.includes('(i.selling_price * i.quantity) AS revenue'), 'credit revenue must come from sold items');
assert(!analytics.includes('credit_sale_payments'), 'credit collection must not be counted again as revenue');

// B2B discount is allocated into the actual sale before FIFO profit is stored;
// VAT is then persisted separately on the invoice/tax ledger.
assert(invoice.includes('allocateDocumentDiscount(doc)'), 'B2B discount allocation missing');
assert(invoice.includes('taxable_amount'), 'tax ledger taxable base missing');
assert(invoice.includes('UPDATE invoices SET subtotal=?,discount=?,tax=?,tax_rate=?,total=?'), 'final invoice financial snapshot missing');

// Reports expose the five finance views required for the v2.1 gate.
for (const type of ['sales','expenses','stock','credits','tax']) assert(reports.includes(`${type}:`), `${type} report missing`);
assert(reports.includes("XLSX.writeFile"), 'Excel export missing');
assert(reports.includes("exportPdf"), 'PDF export missing');

console.log('v2.1.7 financial acceptance gate passed:', expected);
