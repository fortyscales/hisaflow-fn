const crypto = require('crypto');

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
function addColumn(db, table, column, definition) {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function normalizeLegacySyncOutbox(db) {
  const cols = tableColumns(db, 'sync_outbox');
  if (!cols.length) return;
  const names = new Set(cols.map((c) => c.name));
  // Pre-v1 HisaFlow used event_type (NOT NULL) and a different envelope. Keeping
  // that physical column would make every modern outbox INSERT fail unless it
  // also supplied the obsolete field. Rebuild once into the canonical schema.
  if (!names.has('event_type')) return;

  const has = (name) => names.has(name);
  const expr = (name, fallback) => has(name) ? name : fallback;
  const payloadExpr = has('payload') ? 'payload' : (has('data') ? 'data' : 'NULL');
  const entityTypeExpr = has('entity_type')
    ? "COALESCE(entity_type, event_type, 'legacy')"
    : "COALESCE(event_type, 'legacy')";
  const syncedAtExpr = has('synced_at')
    ? 'synced_at'
    : (has('synced') ? "CASE WHEN synced = 1 THEN COALESCE(" + expr('created_at', 'CURRENT_TIMESTAMP') + ", CURRENT_TIMESTAMP) ELSE NULL END" : 'NULL');

  // Existing durable-sync triggers reference sync_outbox by name. SQLite validates
  // those trigger bodies while the table is being replaced, so preserve their SQL,
  // temporarily drop them, rebuild the table, then recreate them verbatim.
  const dependentTriggers = db.prepare(`
    SELECT name, sql FROM sqlite_master
    WHERE type='trigger' AND sql IS NOT NULL AND instr(lower(sql), 'sync_outbox') > 0
  `).all();
  for (const trigger of dependentTriggers) {
    db.exec(`DROP TRIGGER IF EXISTS "${String(trigger.name).replace(/"/g, '""')}"`);
  }

  db.exec(`
    DROP TABLE IF EXISTS sync_outbox_v2_rebuild;
    CREATE TABLE sync_outbox_v2_rebuild (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      synced_at TEXT
    );
  `);

  // Do NOT copy the legacy physical id into the canonical INTEGER PRIMARY KEY.
  // Historical outbox ids are strings such as evt_...; SQLite cannot insert those into
  // INTEGER PRIMARY KEY. Let SQLite allocate fresh row ids while preserving event_id.
  db.exec(`
    INSERT INTO sync_outbox_v2_rebuild
      (event_id, entity_type, entity_id, operation, payload, created_at, attempts, last_error, synced_at)
    SELECT
      COALESCE(${expr('event_id', 'NULL')}, 'legacy_evt_' || ${expr('id', "lower(hex(randomblob(8)))")} || '_' || lower(hex(randomblob(8)))),
      ${entityTypeExpr},
      COALESCE(${expr('entity_id', 'NULL')}, 'legacy_' || ${expr('id', "lower(hex(randomblob(8)))")}),
      COALESCE(${expr('operation', 'NULL')}, 'UPSERT'),
      ${payloadExpr},
      COALESCE(${expr('created_at', 'NULL')}, CURRENT_TIMESTAMP),
      COALESCE(${expr('attempts', 'NULL')}, 0),
      ${expr('last_error', 'NULL')},
      ${syncedAtExpr}
    FROM sync_outbox;
    DROP TABLE sync_outbox;
    ALTER TABLE sync_outbox_v2_rebuild RENAME TO sync_outbox;
  `);

  for (const trigger of dependentTriggers) {
    db.exec(trigger.sql);
  }
}


function normalizeLegacyInvoices(db) {
  const cols = tableColumns(db, 'invoices');
  if (!cols.length) return;
  const names = new Set(cols.map((c) => c.name));

  // Pre-v2.1 HisaFlow already had a small invoices table. CREATE TABLE IF NOT
  // EXISTS cannot evolve it, and the legacy credit_sale_id was NOT NULL, which
  // also prevents modern cash/B2B invoices. Rebuild it before migration 11.
  const canonicalV11 = [
    'id','invoice_number','credit_sale_id','customer_name','customer_phone',
    'customer_company','customer_address','customer_tin','payment_terms',
    'issue_date','due_date','status','total','shop_id','device_id','created_at','updated_at'
  ];
  const creditSale = cols.find((c) => c.name === 'credit_sale_id');
  const needsRebuild = canonicalV11.some((name) => !names.has(name)) || Boolean(creditSale && creditSale.notnull);
  if (!needsRebuild) return;

  const has = (name) => names.has(name);
  const col = (name, fallback='NULL') => has(name) ? `i.${name}` : fallback;
  const issueDate = has('issue_date') ? 'i.issue_date' : (has('created_at') ? 'i.created_at' : 'CURRENT_TIMESTAMP');
  const createdAt = has('created_at') ? 'i.created_at' : issueDate;
  const total = has('total') ? 'i.total' : (has('credit_sale_id')
    ? 'COALESCE((SELECT cs.total_amount FROM credit_sales cs WHERE cs.id=i.credit_sale_id),0)'
    : '0');
  const status = has('status') ? 'i.status' : (has('credit_sale_id')
    ? "COALESCE((SELECT CASE WHEN cs.amount_paid >= cs.total_amount THEN 'paid' WHEN cs.amount_paid > 0 THEN 'partial' ELSE 'issued' END FROM credit_sales cs WHERE cs.id=i.credit_sale_id),'issued')"
    : "'issued'");

  db.exec(`
    DROP TABLE IF EXISTS invoices_v21_rebuild;
    CREATE TABLE invoices_v21_rebuild (
      id TEXT PRIMARY KEY,
      invoice_number INTEGER NOT NULL UNIQUE,
      credit_sale_id TEXT UNIQUE REFERENCES credit_sales(id) ON DELETE SET NULL,
      customer_name TEXT,
      customer_phone TEXT,
      customer_company TEXT,
      customer_address TEXT,
      customer_tin TEXT,
      payment_terms TEXT NOT NULL DEFAULT 'due_on_receipt',
      issue_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'issued',
      total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
      shop_id TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO invoices_v21_rebuild (
      id, invoice_number, credit_sale_id, customer_name, customer_phone,
      customer_company, customer_address, customer_tin, payment_terms,
      issue_date, due_date, status, total, shop_id, device_id, created_at, updated_at
    )
    SELECT
      i.id, i.invoice_number, ${col('credit_sale_id')}, ${col('customer_name')}, ${col('customer_phone')},
      ${col('customer_company')}, ${col('customer_address')}, ${col('customer_tin')},
      COALESCE(${col('payment_terms', "'due_on_receipt'")}, 'due_on_receipt'),
      COALESCE(${issueDate}, CURRENT_TIMESTAMP), ${col('due_date')}, ${status}, ${total},
      ${col('shop_id')}, ${col('device_id')}, COALESCE(${createdAt}, CURRENT_TIMESTAMP),
      COALESCE(${col('updated_at', createdAt)}, CURRENT_TIMESTAMP)
    FROM invoices i;
    DROP TABLE invoices;
    ALTER TABLE invoices_v21_rebuild RENAME TO invoices;
  `);
}

const migrations = [
  {
    version: 1,
    name: 'sync-ready-foundation',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS system_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          batch_id TEXT,
          movement_type TEXT NOT NULL,
          quantity_delta REAL NOT NULL,
          unit_cost REAL,
          reference_type TEXT,
          reference_id TEXT,
          actor_name TEXT,
          device_id TEXT,
          shop_id TEXT,
          created_at TEXT NOT NULL,
          metadata TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date ON stock_movements(product_id, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

        CREATE TABLE IF NOT EXISTS sync_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT,
          created_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          synced_at TEXT
        );
      `);

      normalizeLegacySyncOutbox(db);

      // Compatibility repair for databases created by pre-migration HisaFlow builds.
      // CREATE TABLE IF NOT EXISTS does not evolve an existing table, so an older
      // sync_outbox can exist without entity_type/entity_id/etc. Add every column
      // required by the v1+ outbox BEFORE creating indexes or triggers that reference
      // them. Columns added to an existing SQLite table are intentionally nullable;
      // old rows are backfilled below and all new writes provide the full envelope.
      addColumn(db, 'sync_outbox', 'event_id', 'TEXT');
      addColumn(db, 'sync_outbox', 'entity_type', 'TEXT');
      addColumn(db, 'sync_outbox', 'entity_id', 'TEXT');
      addColumn(db, 'sync_outbox', 'operation', 'TEXT');
      addColumn(db, 'sync_outbox', 'payload', 'TEXT');
      addColumn(db, 'sync_outbox', 'created_at', 'TEXT');
      addColumn(db, 'sync_outbox', 'attempts', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'sync_outbox', 'last_error', 'TEXT');
      addColumn(db, 'sync_outbox', 'synced_at', 'TEXT');

      const now = new Date().toISOString();
      db.prepare(`UPDATE sync_outbox SET
        event_id = COALESCE(event_id, 'legacy_evt_' || id || '_' || lower(hex(randomblob(8)))),
        entity_type = COALESCE(entity_type, 'legacy'),
        entity_id = COALESCE(entity_id, 'legacy_' || id),
        operation = COALESCE(operation, 'UPSERT'),
        created_at = COALESCE(created_at, ?),
        attempts = COALESCE(attempts, 0)
      `).run(now);
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_event_id ON sync_outbox(event_id);
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox(synced_at, id);
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_type, entity_id, id);
      `);
      const insertMeta = db.prepare('INSERT OR IGNORE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)');
      insertMeta.run('device_id', randomId('device'), now);
      insertMeta.run('shop_id', randomId('shop'), now);
      insertMeta.run('schema_generation', 'sync-ready-v1', now);

      const syncTables = [
        'products','stock_batches','sales','credit_sales','credit_sale_items','credit_sale_payments',
        'expenditures','suppliers','supplier_payments','staff','activity_log','orders','order_items'
      ];
      for (const table of syncTables) {
        addColumn(db, table, 'updated_at', 'TEXT');
        addColumn(db, table, 'version', 'INTEGER NOT NULL DEFAULT 1');
      }
      db.exec(`
        UPDATE products SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
        UPDATE stock_batches SET updated_at = COALESCE(updated_at, date, CURRENT_TIMESTAMP);
        UPDATE sales SET updated_at = COALESCE(updated_at, edited_at, date, CURRENT_TIMESTAMP);
        UPDATE credit_sales SET updated_at = COALESCE(updated_at, date, CURRENT_TIMESTAMP);
        UPDATE credit_sale_items SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
        UPDATE credit_sale_payments SET updated_at = COALESCE(updated_at, date, CURRENT_TIMESTAMP);
        UPDATE expenditures SET updated_at = COALESCE(updated_at, date, CURRENT_TIMESTAMP);
        UPDATE suppliers SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
        UPDATE supplier_payments SET updated_at = COALESCE(updated_at, date, CURRENT_TIMESTAMP);
        UPDATE staff SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
        UPDATE activity_log SET updated_at = COALESCE(updated_at, date, CURRENT_TIMESTAMP);
        UPDATE orders SET updated_at = COALESCE(updated_at, fulfilled_at, date, CURRENT_TIMESTAMP);
        UPDATE order_items SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
      `);

      // Backfill a baseline ledger from batches. Historical sales created before the ledger
      // cannot be perfectly reconstructed, so this records the imported opening quantity only.
      const deviceId = db.prepare("SELECT value FROM system_meta WHERE key='device_id'").pluck().get();
      const shopId = db.prepare("SELECT value FROM system_meta WHERE key='shop_id'").pluck().get();
      const existing = db.prepare('SELECT COUNT(*) FROM stock_movements').pluck().get();
      if (!existing) {
        const rows = db.prepare('SELECT id, product_id, quantity, buying_price, date FROM stock_batches').all();
        const ins = db.prepare(`INSERT INTO stock_movements
          (id, product_id, batch_id, movement_type, quantity_delta, unit_cost, reference_type, reference_id, device_id, shop_id, created_at, metadata)
          VALUES (?, ?, ?, 'OPENING_BATCH', ?, ?, 'stock_batch', ?, ?, ?, ?, ?)`);
        for (const b of rows) ins.run(randomId('mov'), b.product_id, b.id, b.quantity, b.buying_price, b.id, deviceId, shopId, b.date || now, JSON.stringify({ migrated: true }));
      }

      // From this point forward every stock batch mutation automatically leaves an audit trail.
      // Explicit domain services can later add richer reference IDs without changing the ledger schema.
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_stock_movement_batch_insert
        AFTER INSERT ON stock_batches
        BEGIN
          INSERT INTO stock_movements (id, product_id, batch_id, movement_type, quantity_delta, unit_cost, reference_type, reference_id, device_id, shop_id, created_at)
          VALUES ('mov_' || lower(hex(randomblob(16))), NEW.product_id, NEW.id, 'STOCK_IN', NEW.remaining, NEW.buying_price,
            'stock_batch', NEW.id,
            (SELECT value FROM system_meta WHERE key='device_id'), (SELECT value FROM system_meta WHERE key='shop_id'), COALESCE(NEW.date, CURRENT_TIMESTAMP));
        END;
        CREATE TRIGGER IF NOT EXISTS trg_stock_movement_batch_remaining
        AFTER UPDATE OF remaining ON stock_batches
        WHEN NEW.remaining <> OLD.remaining
        BEGIN
          INSERT INTO stock_movements (id, product_id, batch_id, movement_type, quantity_delta, unit_cost, reference_type, reference_id, device_id, shop_id, created_at)
          VALUES ('mov_' || lower(hex(randomblob(16))), NEW.product_id, NEW.id,
            CASE WHEN NEW.remaining > OLD.remaining THEN 'STOCK_RESTORE' ELSE 'STOCK_OUT' END,
            NEW.remaining - OLD.remaining, NEW.buying_price, 'stock_batch', NEW.id,
            (SELECT value FROM system_meta WHERE key='device_id'), (SELECT value FROM system_meta WHERE key='shop_id'), CURRENT_TIMESTAMP);
        END;
      `);
    },
  },
  {
    version: 3,
    name: 'durable-sync-outbox',
    up(db) {
      const tables = [
        ['products','product'], ['sales','sale'], ['credit_sales','credit_sale'],
        ['credit_sale_items','credit_sale_item'], ['credit_sale_payments','credit_payment'],
        ['expenditures','expenditure'], ['suppliers','supplier'], ['supplier_payments','supplier_payment'],
        ['staff','staff'], ['orders','order'], ['order_items','order_item'], ['stock_movements','stock_movement']
      ];
      for (const [table, entity] of tables) {
        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_outbox_${table}_insert AFTER INSERT ON ${table}
          BEGIN
            INSERT INTO sync_outbox(event_id, entity_type, entity_id, operation, created_at)
            VALUES ('evt_' || lower(hex(randomblob(16))), '${entity}', NEW.id, 'UPSERT', CURRENT_TIMESTAMP);
          END;
          CREATE TRIGGER IF NOT EXISTS trg_outbox_${table}_update AFTER UPDATE ON ${table}
          BEGIN
            INSERT INTO sync_outbox(event_id, entity_type, entity_id, operation, created_at)
            VALUES ('evt_' || lower(hex(randomblob(16))), '${entity}', NEW.id, 'UPSERT', CURRENT_TIMESTAMP);
          END;
          CREATE TRIGGER IF NOT EXISTS trg_outbox_${table}_delete AFTER DELETE ON ${table}
          BEGIN
            INSERT INTO sync_outbox(event_id, entity_type, entity_id, operation, created_at)
            VALUES ('evt_' || lower(hex(randomblob(16))), '${entity}', OLD.id, 'DELETE', CURRENT_TIMESTAMP);
          END;
        `);
      }
    },
  },
  {
    version: 2,
    name: 'query-and-integrity-indexes',
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_date_product ON sales(date, product_id);
        CREATE INDEX IF NOT EXISTS idx_credit_sales_status_date ON credit_sales(status, date);
        CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, date);
        CREATE INDEX IF NOT EXISTS idx_activity_date_action ON activity_log(date, action);
        CREATE INDEX IF NOT EXISTS idx_batches_sellable_fifo ON stock_batches(product_id, date, id) WHERE remaining > 0;
      `);
    },
  },

  {
    version: 4,
    name: 'idempotent-business-commands',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS operation_receipts (
          operation_id TEXT PRIMARY KEY,
          command_type TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          response_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_operation_receipts_created ON operation_receipts(created_at);
      `);
    },
  },

  {
    version: 5,
    name: 'interactive-query-performance',
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_date_id ON sales(date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_expenditures_date_id ON expenditures(date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_date_id ON activity_log(date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_crash_timestamp_id ON crash_log(timestamp DESC, id DESC);
      `);
    },
  },

  {
    version: 6,
    name: 'analytics-query-engine',
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_actor_date ON sales(actor_name, date);
        CREATE INDEX IF NOT EXISTS idx_credit_sales_actor_date ON credit_sales(actor_name, date);
        CREATE INDEX IF NOT EXISTS idx_credit_items_product_sale ON credit_sale_items(product_id, credit_sale_id);
        CREATE INDEX IF NOT EXISTS idx_expenditures_date_amount ON expenditures(date, amount);
      `);
    },
  },


  {
    version: 7,
    name: 'accounting-grade-inventory-ledger',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS stock_movement_context (
          batch_id TEXT PRIMARY KEY,
          movement_type TEXT NOT NULL,
          reference_type TEXT,
          reference_id TEXT,
          actor_name TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_stock_movements_type_date
          ON stock_movements(movement_type, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_product_date
          ON stock_movements(shop_id, product_id, created_at, id);
      `);

      // Older versions seeded the ledger from original batch quantity even when
      // part of that batch had already been sold. Add one explicit migration
      // reconciliation per product so the append-only ledger starts v0.9 at
      // exactly the same on-hand quantity as the retained FIFO batches.
      const now = new Date().toISOString();
      const deviceId = db.prepare("SELECT value FROM system_meta WHERE key='device_id'").pluck().get();
      const shopId = db.prepare("SELECT value FROM system_meta WHERE key='shop_id'").pluck().get();
      const drift = db.prepare(`
        SELECT p.id AS product_id,
               COALESCE((SELECT SUM(b.remaining) FROM stock_batches b WHERE b.product_id=p.id),0) AS batch_stock,
               COALESCE((SELECT SUM(m.quantity_delta) FROM stock_movements m WHERE m.product_id=p.id),0) AS ledger_stock
        FROM products p
      `).all();
      const insert = db.prepare(`INSERT INTO stock_movements
        (id, product_id, movement_type, quantity_delta, reference_type, reference_id, device_id, shop_id, created_at, metadata)
        VALUES (?, ?, 'MIGRATION_RECONCILIATION', ?, 'migration', 'v0.9-ledger-baseline', ?, ?, ?, ?)`);
      for (const row of drift) {
        const delta = Number(row.batch_stock) - Number(row.ledger_stock);
        if (Math.abs(delta) > 0.000001) {
          insert.run(randomId('mov'), row.product_id, delta, deviceId, shopId, now,
            JSON.stringify({ reason: 'Align legacy ledger to retained FIFO on-hand quantity', previousLedgerStock: Number(row.ledger_stock), batchStock: Number(row.batch_stock) }));
        }
      }

      // Replace generic triggers with context-aware append-only ledger triggers.
      // Domain services can describe WHY a batch changed; legacy/import paths
      // still get safe generic movement types rather than an untracked mutation.
      db.exec(`
        DROP TRIGGER IF EXISTS trg_stock_movement_batch_insert;
        DROP TRIGGER IF EXISTS trg_stock_movement_batch_remaining;

        CREATE TRIGGER trg_stock_movement_batch_insert
        AFTER INSERT ON stock_batches
        BEGIN
          INSERT INTO stock_movements
            (id, product_id, batch_id, movement_type, quantity_delta, unit_cost,
             reference_type, reference_id, actor_name, device_id, shop_id, created_at, metadata)
          VALUES (
            'mov_' || lower(hex(randomblob(16))), NEW.product_id, NEW.id,
            COALESCE((SELECT movement_type FROM stock_movement_context WHERE batch_id=NEW.id), 'PURCHASE'),
            NEW.remaining, NEW.buying_price,
            COALESCE((SELECT reference_type FROM stock_movement_context WHERE batch_id=NEW.id), 'stock_batch'),
            COALESCE((SELECT reference_id FROM stock_movement_context WHERE batch_id=NEW.id), NEW.id),
            (SELECT actor_name FROM stock_movement_context WHERE batch_id=NEW.id),
            (SELECT value FROM system_meta WHERE key='device_id'),
            (SELECT value FROM system_meta WHERE key='shop_id'),
            COALESCE((SELECT created_at FROM stock_movement_context WHERE batch_id=NEW.id), NEW.date, CURRENT_TIMESTAMP),
            (SELECT metadata FROM stock_movement_context WHERE batch_id=NEW.id)
          );
          DELETE FROM stock_movement_context WHERE batch_id=NEW.id;
        END;

        CREATE TRIGGER trg_stock_movement_batch_remaining
        AFTER UPDATE OF remaining ON stock_batches
        WHEN ABS(NEW.remaining - OLD.remaining) > 0.0000001
        BEGIN
          INSERT INTO stock_movements
            (id, product_id, batch_id, movement_type, quantity_delta, unit_cost,
             reference_type, reference_id, actor_name, device_id, shop_id, created_at, metadata)
          VALUES (
            'mov_' || lower(hex(randomblob(16))), NEW.product_id, NEW.id,
            COALESCE((SELECT movement_type FROM stock_movement_context WHERE batch_id=NEW.id),
                     CASE WHEN NEW.remaining > OLD.remaining THEN 'RESTORE' ELSE 'STOCK_OUT' END),
            NEW.remaining - OLD.remaining, NEW.buying_price,
            COALESCE((SELECT reference_type FROM stock_movement_context WHERE batch_id=NEW.id), 'stock_batch'),
            COALESCE((SELECT reference_id FROM stock_movement_context WHERE batch_id=NEW.id), NEW.id),
            (SELECT actor_name FROM stock_movement_context WHERE batch_id=NEW.id),
            (SELECT value FROM system_meta WHERE key='device_id'),
            (SELECT value FROM system_meta WHERE key='shop_id'),
            COALESCE((SELECT created_at FROM stock_movement_context WHERE batch_id=NEW.id), CURRENT_TIMESTAMP),
            (SELECT metadata FROM stock_movement_context WHERE batch_id=NEW.id)
          );
          DELETE FROM stock_movement_context WHERE batch_id=NEW.id;
        END;
      `);
    },
  },

  {
    version: 8,
    name: 'reliability-core-guards',
    up(db) {
      // SQLite cannot add CHECK constraints to existing tables in place without
      // rebuilding them. Guard triggers give existing installations the same
      // protection safely, and map directly to CHECK constraints in PostgreSQL.
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS guard_batch_insert BEFORE INSERT ON stock_batches
        WHEN NEW.quantity <= 0 OR NEW.remaining < 0 OR NEW.remaining > NEW.quantity OR NEW.buying_price < 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_STOCK_BATCH'); END;
        CREATE TRIGGER IF NOT EXISTS guard_batch_update BEFORE UPDATE OF quantity, remaining, buying_price ON stock_batches
        WHEN NEW.quantity <= 0 OR NEW.remaining < 0 OR NEW.remaining > NEW.quantity OR NEW.buying_price < 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_STOCK_BATCH'); END;

        CREATE TRIGGER IF NOT EXISTS guard_product_stock_update BEFORE UPDATE OF stock ON products
        WHEN NEW.stock < -0.0000001
        BEGIN SELECT RAISE(ABORT, 'NEGATIVE_PRODUCT_STOCK'); END;

        CREATE TRIGGER IF NOT EXISTS guard_sale_insert BEFORE INSERT ON sales
        WHEN NEW.quantity <= 0 OR NEW.selling_price < 0 OR COALESCE(NEW.total_cost,0) < 0 OR COALESCE(NEW.total_revenue,0) < 0 OR COALESCE(NEW.discount,0) < 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_SALE_VALUES'); END;

        CREATE TRIGGER IF NOT EXISTS guard_credit_insert BEFORE INSERT ON credit_sales
        WHEN NEW.total_amount < 0 OR NEW.amount_paid < 0 OR NEW.amount_paid > NEW.total_amount OR NEW.status NOT IN ('pending','partial','paid')
        BEGIN SELECT RAISE(ABORT, 'INVALID_CREDIT_BALANCE'); END;
        CREATE TRIGGER IF NOT EXISTS guard_credit_update BEFORE UPDATE OF total_amount, amount_paid, status ON credit_sales
        WHEN NEW.total_amount < 0 OR NEW.amount_paid < 0 OR NEW.amount_paid > NEW.total_amount OR NEW.status NOT IN ('pending','partial','paid')
        BEGIN SELECT RAISE(ABORT, 'INVALID_CREDIT_BALANCE'); END;
        CREATE TRIGGER IF NOT EXISTS guard_credit_payment_insert BEFORE INSERT ON credit_sale_payments
        WHEN NEW.amount <= 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_CREDIT_PAYMENT'); END;

        CREATE TRIGGER IF NOT EXISTS guard_expense_insert BEFORE INSERT ON expenditures
        WHEN NEW.amount <= 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_EXPENSE'); END;
        CREATE TRIGGER IF NOT EXISTS guard_expense_update BEFORE UPDATE OF amount ON expenditures
        WHEN NEW.amount <= 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_EXPENSE'); END;

        CREATE TRIGGER IF NOT EXISTS guard_supplier_payment_insert BEFORE INSERT ON supplier_payments
        WHEN NEW.amount <= 0
        BEGIN SELECT RAISE(ABORT, 'INVALID_SUPPLIER_PAYMENT'); END;

        CREATE INDEX IF NOT EXISTS idx_credit_payments_sale_date ON credit_sale_payments(credit_sale_id, date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_date ON supplier_payments(supplier_id, date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_outbox_unsynced_created ON sync_outbox(created_at, id) WHERE synced_at IS NULL;
      `);
    },
  },


  {
    version: 9,
    name: 'sync-protocol-v1',
    up(db) {
      addColumn(db, 'sync_outbox', 'shop_id', 'TEXT');
      addColumn(db, 'sync_outbox', 'device_id', 'TEXT');
      addColumn(db, 'sync_outbox', 'entity_version', 'INTEGER');
      addColumn(db, 'sync_outbox', 'next_attempt_at', 'TEXT');
      addColumn(db, 'sync_outbox', 'lease_token', 'TEXT');
      addColumn(db, 'sync_outbox', 'lease_expires_at', 'TEXT');
      addColumn(db, 'sync_outbox', 'dead_lettered_at', 'TEXT');
      db.exec(`
        UPDATE sync_outbox SET
          shop_id=COALESCE(shop_id,(SELECT value FROM system_meta WHERE key='shop_id')),
          device_id=COALESCE(device_id,(SELECT value FROM system_meta WHERE key='device_id'));
        CREATE INDEX IF NOT EXISTS idx_outbox_ready
          ON sync_outbox(next_attempt_at, id)
          WHERE synced_at IS NULL AND dead_lettered_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_outbox_lease ON sync_outbox(lease_token) WHERE lease_token IS NOT NULL;
      `);
      const now = new Date().toISOString();
      const meta = db.prepare(`INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
      meta.run('sync_protocol_version', '1', now);
      meta.run('sync_conflict_policy', 'server-revision-with-idempotent-events', now);
    },
  },

  {
    version: 10,
    name: 'postgres-ready-tenant-model',
    up(db) {
      const tenantTables = [
        'products','stock_batches','sales','credit_sales','credit_sale_items','credit_sale_payments',
        'expenditures','suppliers','supplier_payments','staff','activity_log','orders','order_items'
      ];
      for (const table of tenantTables) {
        addColumn(db, table, 'shop_id', 'TEXT');
        addColumn(db, table, 'device_id', 'TEXT');
      }
      const shopId = db.prepare("SELECT value FROM system_meta WHERE key='shop_id'").pluck().get();
      const deviceId = db.prepare("SELECT value FROM system_meta WHERE key='device_id'").pluck().get();
      for (const table of tenantTables) {
        db.prepare(`UPDATE ${table} SET shop_id=COALESCE(shop_id,?), device_id=COALESCE(device_id,?)`).run(shopId, deviceId);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_shop_id ON ${table}(shop_id, id)`);
      }
      // Child lookups used by the server-side PostgreSQL model always remain tenant-scoped.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_batches_shop_product_fifo ON stock_batches(shop_id, product_id, date, id) WHERE remaining > 0;
        CREATE INDEX IF NOT EXISTS idx_sales_shop_date ON sales(shop_id, date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_credit_shop_date ON credit_sales(shop_id, date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON expenditures(shop_id, date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_orders_shop_status_date ON orders(shop_id, status, date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_movements_shop_product_date ON stock_movements(shop_id, product_id, created_at DESC, id DESC);
      `);
      const now = new Date().toISOString();
      const meta = db.prepare(`INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
      meta.run('data_model_version', 'postgres-ready-v1', now);
      meta.run('tenant_model', 'shop-scoped', now);
      meta.run('id_strategy', 'uuid-text', now);
      meta.run('timestamp_strategy', 'iso8601-utc', now);
    },
  },

  {
    version: 11,
    name: 'merchant-finance-invoices',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number INTEGER NOT NULL UNIQUE,
          credit_sale_id TEXT UNIQUE REFERENCES credit_sales(id) ON DELETE SET NULL,
          customer_name TEXT,
          customer_phone TEXT,
          customer_company TEXT,
          customer_address TEXT,
          customer_tin TEXT,
          payment_terms TEXT NOT NULL DEFAULT 'due_on_receipt',
          issue_date TEXT NOT NULL,
          due_date TEXT,
          status TEXT NOT NULL DEFAULT 'issued',
          total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
          shop_id TEXT,
          device_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS invoice_items (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          product_id TEXT,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL CHECK(quantity > 0),
          unit_price REAL NOT NULL CHECK(unit_price >= 0),
          line_total REAL NOT NULL CHECK(line_total >= 0),
          shop_id TEXT,
          device_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date DESC, invoice_number DESC);
        CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id, id);
      `);
    },
  },


  {
    version: 12,
    name: 'b2b-and-cash-sale-invoices',
    up(db) {
      const cols = new Set(db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name));
      const add = (name, ddl) => { if (!cols.has(name)) db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${ddl}`); };
      add('sale_id', 'TEXT REFERENCES sales(id) ON DELETE SET NULL');
      add('invoice_kind', "TEXT NOT NULL DEFAULT 'standard'");
      add('customer_email', 'TEXT');
      add('customer_registration_no', 'TEXT');
      add('purchase_order_no', 'TEXT');
      add('notes', 'TEXT');
      add('amount_paid', 'REAL NOT NULL DEFAULT 0');
      // Preserve settlement state for invoices created by the pre-v2.1 credit invoice feature.
      // Those rows had no amount_paid column; the linked credit sale is authoritative.
      db.exec(`
        UPDATE invoices
        SET amount_paid = COALESCE((SELECT cs.amount_paid FROM credit_sales cs WHERE cs.id=invoices.credit_sale_id), amount_paid)
        WHERE credit_sale_id IS NOT NULL AND amount_paid = 0;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sale_id ON invoices(sale_id) WHERE sale_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_invoices_customer_company ON invoices(customer_company, issue_date DESC);
      `);
    },
  },


  {
    version: 13,
    name: 'b2b-commercial-documents',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS commercial_documents (
          id TEXT PRIMARY KEY,
          document_type TEXT NOT NULL CHECK(document_type IN ('quotation','proforma')),
          document_number INTEGER NOT NULL,
          customer_company TEXT NOT NULL,
          contact_person TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          customer_address TEXT,
          customer_tin TEXT,
          customer_registration_no TEXT,
          purchase_order_no TEXT,
          issue_date TEXT NOT NULL,
          valid_until TEXT,
          payment_terms TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','accepted','rejected','expired','converted')),
          subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
          discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
          tax REAL NOT NULL DEFAULT 0 CHECK(tax >= 0),
          total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
          source_document_id TEXT REFERENCES commercial_documents(id) ON DELETE SET NULL,
          shop_id TEXT,
          device_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(document_type, document_number)
        );
        CREATE TABLE IF NOT EXISTS commercial_document_items (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES commercial_documents(id) ON DELETE CASCADE,
          product_id TEXT,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL CHECK(quantity > 0),
          unit_price REAL NOT NULL CHECK(unit_price >= 0),
          line_total REAL NOT NULL CHECK(line_total >= 0),
          shop_id TEXT,
          device_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_commercial_docs_type_date ON commercial_documents(document_type, issue_date DESC, document_number DESC);
        CREATE INDEX IF NOT EXISTS idx_commercial_docs_company ON commercial_documents(customer_company, issue_date DESC);
        CREATE INDEX IF NOT EXISTS idx_commercial_doc_items_doc ON commercial_document_items(document_id, id);
      `);
    },
  },


  {
    version: 14,
    name: 'b2b-document-transaction-linkage',
    up(db) {
      const docCols = new Set(db.prepare("PRAGMA table_info(commercial_documents)").all().map(c => c.name));
      const invCols = new Set(db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name));
      if (!docCols.has('converted_credit_sale_id')) db.exec("ALTER TABLE commercial_documents ADD COLUMN converted_credit_sale_id TEXT");
      if (!docCols.has('converted_invoice_id')) db.exec("ALTER TABLE commercial_documents ADD COLUMN converted_invoice_id TEXT");
      if (!docCols.has('converted_at')) db.exec("ALTER TABLE commercial_documents ADD COLUMN converted_at TEXT");
      if (!invCols.has('source_document_id')) db.exec("ALTER TABLE invoices ADD COLUMN source_document_id TEXT");
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_commercial_docs_credit_sale ON commercial_documents(converted_credit_sale_id) WHERE converted_credit_sale_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_commercial_docs_invoice ON commercial_documents(converted_invoice_id) WHERE converted_invoice_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_invoices_source_document ON invoices(source_document_id) WHERE source_document_id IS NOT NULL;
      `);
    },
  },


  {
    version: 15,
    name: 'b2b-cash-conversion-and-invoice-register',
    up(db) {
      const docCols = new Set(db.prepare("PRAGMA table_info(commercial_documents)").all().map(c => c.name));
      if (!docCols.has('converted_sale_ids')) db.exec("ALTER TABLE commercial_documents ADD COLUMN converted_sale_ids TEXT");
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_source_document_unique ON invoices(source_document_id) WHERE source_document_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_invoices_due_status ON invoices(status, due_date, issue_date DESC);
      `);
    },
  },


  {
    version: 16,
    name: 'invoice-tax-discount-accounting',
    up(db) {
      const invCols = new Set(db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name));
      const add = (name, ddl) => { if (!invCols.has(name)) db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${ddl}`); };
      add('subtotal', 'REAL NOT NULL DEFAULT 0');
      add('discount', 'REAL NOT NULL DEFAULT 0');
      add('tax', 'REAL NOT NULL DEFAULT 0');
      add('tax_rate', 'REAL NOT NULL DEFAULT 0');
      db.exec(`
        CREATE TABLE IF NOT EXISTS tax_ledger (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          source_document_id TEXT,
          tax_type TEXT NOT NULL DEFAULT 'sales_tax',
          taxable_amount REAL NOT NULL CHECK(taxable_amount >= 0),
          tax_rate REAL NOT NULL CHECK(tax_rate >= 0),
          tax_amount REAL NOT NULL CHECK(tax_amount >= 0),
          date TEXT NOT NULL,
          shop_id TEXT,
          device_id TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(invoice_id, tax_type)
        );
        CREATE INDEX IF NOT EXISTS idx_tax_ledger_date ON tax_ledger(date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_tax_ledger_invoice ON tax_ledger(invoice_id);
      `);
      db.exec(`UPDATE invoices SET subtotal=CASE WHEN subtotal=0 THEN total ELSE subtotal END WHERE subtotal=0 AND total>0`);
    },
  },


  {
    version: 17,
    name: 'payment-account-ledger',
    up(db) {
      const add = (table, name, ddl) => {
        const cols = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
        if (!cols.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
      };
      add('expenditures','account_id','TEXT'); add('expenditures','account_label','TEXT'); add('expenditures','account_number','TEXT');
      add('credit_sale_payments','account_id','TEXT'); add('credit_sale_payments','account_label','TEXT'); add('credit_sale_payments','account_number','TEXT');
      db.exec(`
        CREATE TABLE IF NOT EXISTS account_ledger (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          account_label TEXT,
          account_number TEXT,
          direction TEXT NOT NULL CHECK(direction IN ('in','out')),
          amount REAL NOT NULL CHECK(amount > 0),
          entry_type TEXT NOT NULL,
          reference_type TEXT NOT NULL,
          reference_id TEXT NOT NULL,
          description TEXT,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(entry_type, reference_type, reference_id)
        );
        CREATE INDEX IF NOT EXISTS idx_account_ledger_account_date ON account_ledger(account_id,date DESC,id DESC);
        CREATE INDEX IF NOT EXISTS idx_account_ledger_reference ON account_ledger(reference_type,reference_id);
      `);
      // Backfill only records that already identify a specific account. This is
      // deterministic and does not invent accounts for historical cash activity.
      db.exec(`
        INSERT OR IGNORE INTO account_ledger(id,account_id,account_label,account_number,direction,amount,entry_type,reference_type,reference_id,description,date,created_at)
        SELECT 'algr_sale_'||id,account_id,account_label,account_number,'in',total_revenue,'sale','sale',id,'Sale: '||product_name,date,date
        FROM sales WHERE account_id IS NOT NULL AND account_id<>'' AND total_revenue>0;
        INSERT OR IGNORE INTO account_ledger(id,account_id,account_label,account_number,direction,amount,entry_type,reference_type,reference_id,description,date,created_at)
        SELECT 'algr_purchase_'||id,account_id,account_label,account_number,'out',quantity*buying_price,'stock_purchase','stock_batch',id,'Stock purchase',date,date
        FROM stock_batches WHERE account_id IS NOT NULL AND account_id<>'' AND quantity>0 AND buying_price>0;
      `);
    },
  },

  {
    version: 21,
    name: 'order-item-product-identity',
    up(db) {
      const cols = new Set(db.prepare(`PRAGMA table_info(order_items)`).all().map(c => c.name));
      const add = (name) => { if (!cols.has(name)) db.exec(`ALTER TABLE order_items ADD COLUMN ${name} TEXT`); };
      ['product_brand','product_size','product_unit','product_category'].forEach(add);
      db.exec(`
        UPDATE order_items
        SET product_brand = COALESCE(product_brand,(SELECT brand FROM products WHERE products.id=order_items.product_id)),
            product_size = COALESCE(product_size,(SELECT size FROM products WHERE products.id=order_items.product_id)),
            product_unit = COALESCE(product_unit,(SELECT unit FROM products WHERE products.id=order_items.product_id)),
            product_category = COALESCE(product_category,(SELECT category FROM products WHERE products.id=order_items.product_id))
      `);
    },
  },

];

function runMigrations(db) {
  // Compatibility preflight MUST run even when migration 1 is already recorded.
  // Some pre-migration/v2.0.x databases have a legacy sync_outbox with
  // event_type TEXT NOT NULL. Modern triggers do not write that obsolete column,
  // so normalize the physical table before any pending migration can emit events.
  const outboxExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sync_outbox'").get();
  if (outboxExists) {
    db.transaction(() => normalizeLegacySyncOutbox(db))();
  }

  // v2.0.x/early legacy builds can already contain an invoices table that
  // predates the v2.1 finance schema. Normalize it before migration 11 creates
  // indexes on issue_date or later migrations create cash/B2B invoices.
  const invoicesExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='invoices'").get();
  if (invoicesExists) {
    db.transaction(() => normalizeLegacyInvoices(db))();
  }

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  const record = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    db.transaction(() => {
      migration.up(db);
      record.run(migration.version, migration.name, new Date().toISOString());
    })();
    console.log(`Applied DB migration ${migration.version}: ${migration.name}`);
  }
  db.pragma(`user_version = ${Math.max(0, ...migrations.map((m) => m.version))}`);
}

module.exports = { runMigrations };
