# NestJS / PostgreSQL migration contract

SQLite remains the desktop source of truth while offline. NestJS is a synchronization and multi-shop coordination boundary, not a prerequisite for checkout.

## Rules

1. Every merchant-owned entity is scoped by `shop_id`.
2. IDs are generated on the client and are globally unique; the server never replaces an offline ID.
3. Timestamps cross the API as UTC ISO-8601 and become PostgreSQL `timestamptz`.
4. `version` is monotonic per entity. Server writes compare versions; stale writes are conflicts, never silent overwrites.
5. Every sync event has a globally unique `eventId`. PostgreSQL stores/acknowledges it once, making retries idempotent.
6. Deletes synchronize as tombstones. Hard deletion is a retention/compaction concern, not a sync operation.
7. Money uses PostgreSQL `numeric`, never floating-point. A later SQLite money migration can move TZS values to integer minor units without changing API semantics.
8. Repository/domain code must not depend on PostgreSQL syntax. SQL-specific query implementations stay in adapters.
9. Server-downloaded mutations are applied to SQLite with outbox emission suppressed to avoid echo loops.
10. Tenant authorization is enforced from authenticated shop membership on the server; a client-supplied `shopId` alone is never authorization.

## NestJS module boundary

`SyncModule` accepts batches of protocol-v1 events, authenticates device/shop membership, inserts `sync_events` idempotently, applies accepted entity versions in a PostgreSQL transaction, and returns per-event ACK/conflict results. Domain modules (Sales, Inventory, Credit, Purchases, Expenses, Orders) reuse the same DTO semantics as desktop domain commands.
