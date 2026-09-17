# HisaFlow Backup & Recovery Contract (v1.7)

## Primary backup
The primary disaster-recovery artifact is a native SQLite snapshot created with SQLite's backup API. JSON export remains a compatibility/portable export and is not the authoritative disaster-recovery format because it cannot preserve every internal table (ledger, outbox, receipts, migrations, metadata).

Every native snapshot is validated with `PRAGMA integrity_check` and `foreign_key_check`, then accompanied by a manifest containing its schema version, byte size and SHA-256 checksum.

## Restore safety rules
A native restore is rejected if it cannot be opened, fails integrity/foreign-key validation, lacks core HisaFlow tables, or has a schema version newer than the installed app understands.

Before replacing the live database HisaFlow creates and validates a `pre-restore-*` safety snapshot. The candidate is copied to a staging file and validated again. Only then is the WAL checkpointed, the live connection closed, WAL/SHM removed and the database replaced. The application relaunches so normal migrations and startup health checks run against the restored database.

## Legacy JSON
JSON restore remains only for compatibility with historical/mobile backup flows. It must not be described as a complete accounting-grade backup. New recovery UX should prefer `.sqlite` snapshots.

## Corruption policy
Never silently repair immutable business history. Cached projections may be rebuilt from canonical records, but ledger discrepancies and database corruption must be surfaced. Recovery should prefer a known-good verified snapshot.
