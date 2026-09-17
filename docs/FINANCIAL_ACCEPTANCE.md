# HisaFlow v2.1 Financial Acceptance Gate

This is the release-gate scenario for the Merchant Finance phase.

1. Receive 10 units at TZS 700 and another 10 at TZS 800.
2. Complete a paid B2B sale of 12 units at TZS 1,000 with TZS 1,200 total discount.
3. Apply 18% VAT to that B2B document. VAT must be TZS 1,944 and must not increase revenue/profit.
4. Complete a credit sale of 3 units at TZS 1,200 and record a TZS 1,000 partial payment.
5. Record a TZS 500 business expense.

Expected accounting state:
- Sales revenue: TZS 14,400
- COGS: TZS 11,000
- Gross profit: TZS 3,400
- Expenses: TZS 500
- Net profit: TZS 2,900
- VAT/tax ledger: TZS 1,944
- Credit outstanding: TZS 2,600
- Ending stock: 5 units
- Ending inventory cost value: TZS 4,000

The Dashboard and exported Sales/Expense/Stock/Credit/Tax reports must agree with these values. Closing and reopening HisaFlow must not change them. A repeated operationId must not duplicate a sale, stock movement, payment, invoice, or tax entry.
