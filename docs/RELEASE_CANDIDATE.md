# HisaFlow Desktop v2.2.0 — Release Candidate Gate

v2.2 freezes the Merchant Finance feature set. No new business capability should enter this branch unless it fixes a release-blocking defect.

## Release invariants

- SQLite remains the local operational source of truth.
- A sale never requires network access.
- FIFO is deterministic and stock mutations are transactional.
- Paid and credit sales are both recognized once in sales reporting.
- Credit collection changes settlement/receivables, not recognized revenue.
- VAT/sales tax is held in the tax ledger and is not sales revenue or profit.
- Quotations and proformas do not mutate stock or accounting until converted through a real sale command.
- Dashboard and reports use the same half-open `[start,end)` reporting boundary.
- Existing v2.0.x/v2.1.x databases must upgrade without deleting merchant data.
- Native SQLite backup/recovery and integrity checks remain available.

## Windows release gate

Run on the same architecture used for the installer:

```bash
npm install
npm run postinstall
npm run test:release-candidate
npm run package
```

Then install over an existing HisaFlow data directory and verify:

1. Existing products, batches, sales, credits, expenses and invoices remain visible.
2. Dashboard All Time reflects historical expenses and agrees with reports.
3. Run `docs/FINANCIAL_ACCEPTANCE.md` through the UI and verify the locked totals.
4. Export Sales, Expenses, Stock, Credits and Tax to both PDF and Excel.
5. Create a standard invoice and a B2B invoice; create quotation → proforma → paid/credit transaction → final invoice.
6. Record a partial credit payment and verify invoice balance/status/payment history.
7. Close and reopen HisaFlow; totals and balances must not change.
8. Create a native SQLite backup, inspect it, restore it, and verify the app relaunches with the same state.
9. Verify a repeated operation/retry does not duplicate a sale, payment, invoice, tax entry or stock movement.
10. Package with electron-builder and install the generated NSIS installer on Windows x64.

Any accounting mismatch, migration crash, integrity failure, duplicate transaction, lost record, or failed restore is a release blocker.
