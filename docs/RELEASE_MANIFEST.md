# HisaFlow Desktop v2.2.0 Release Manifest

- Product: HisaFlow Desktop
- Release line: v2.2 Release Candidate
- SQLite schema migration level: 16
- Local database: SQLite / better-sqlite3
- Desktop runtime: Electron 32
- UI: React 19 + Vite 5
- Primary recovery format: native SQLite snapshot
- Offline sales: required and preserved
- Cloud backend dependency: none

## Frozen v2.2 scope

Inventory/FIFO, paid sales, credit sales and settlement, expenses, dashboard analytics, stock ledger/reconciliation, PDF/Excel finance reports, quotations, proformas, standard/B2B invoices, discount allocation, VAT/tax ledger, backup/recovery, diagnostics, idempotency, and durable sync-outbox contracts.

The next architecture phase is the NestJS/PostgreSQL server and synchronization implementation. Public storefront/profile capabilities should consume the server/public API rather than reading desktop SQLite directly.
