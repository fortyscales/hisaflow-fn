# Production hardening (v1.9)

HisaFlow now uses a stable result envelope for application commands/queries: `{ok:true,data}` or `{ok:false,error:{code,retryable,details,context}}`. Raw SQLite/internal exception text is not part of the renderer contract.

Known transient SQLite lock conditions are classified as retryable (`DATABASE_BUSY`, `DATABASE_LOCKED`). The renderer receives structured `ApplicationError` objects and can decide whether to offer retry without parsing message strings.

Startup health is captured before the main window is created and is available to the renderer. Diagnostics can be viewed or exported as JSON and include app/runtime versions, database health, and sync status. Diagnostics intentionally avoid exporting business tables or customer data.

Database integrity failures remain visible and are not silently repaired. Cached product projections are the only summaries that may be explicitly rebuilt; ledger/history discrepancies require investigation.
