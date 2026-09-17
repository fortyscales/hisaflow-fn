-- HisaFlow PostgreSQL target schema v1 (design contract, not yet used by desktop runtime)
-- Every merchant-owned row is scoped by shop_id. UUIDs are globally unique across offline devices.
CREATE TABLE shops (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE TABLE devices (
  id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id),
  name text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products (
  id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id),
  device_id uuid REFERENCES devices(id),
  name text NOT NULL,
  category text, brand text, size text, unit text NOT NULL DEFAULT 'pc',
  selling_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  buying_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (buying_price >= 0),
  stock numeric(18,4) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_uri text, expiry_date timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at timestamptz
);
CREATE INDEX products_shop_name_idx ON products(shop_id, name) WHERE deleted_at IS NULL;
CREATE TABLE stock_batches (
  id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id),
  device_id uuid REFERENCES devices(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  remaining numeric(18,4) NOT NULL CHECK (remaining >= 0 AND remaining <= quantity),
  buying_price numeric(18,2) NOT NULL CHECK (buying_price >= 0),
  purchased_at timestamptz NOT NULL,
  supplier_id uuid, supplier_name text, payment_method text,
  account_id text, account_label text, account_number text,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX stock_batches_fifo_idx ON stock_batches(shop_id, product_id, purchased_at, id) WHERE remaining > 0;
CREATE TABLE sales (
  id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id),
  device_id uuid REFERENCES devices(id),
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  buying_price numeric(18,2), selling_price numeric(18,2) NOT NULL CHECK (selling_price >= 0),
  total_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  total_revenue numeric(18,2) NOT NULL CHECK (total_revenue >= 0),
  profit numeric(18,2) NOT NULL,
  discount numeric(18,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  payment_method text, notes text, customer_phone text, customer_name text, actor_name text,
  sold_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  batch_breakdown jsonb
);
CREATE INDEX sales_shop_date_idx ON sales(shop_id, sold_at DESC, id DESC);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id), device_id uuid REFERENCES devices(id),
  product_id uuid NOT NULL, batch_id uuid,
  movement_type text NOT NULL, quantity_delta numeric(18,4) NOT NULL,
  unit_cost numeric(18,2), reference_type text, reference_id uuid,
  actor_name text, created_at timestamptz NOT NULL, metadata jsonb
);
CREATE INDEX stock_movements_history_idx ON stock_movements(shop_id, product_id, created_at DESC, id DESC);
CREATE TABLE sync_events (
  event_id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES shops(id), device_id uuid NOT NULL REFERENCES devices(id),
  entity_type text NOT NULL, entity_id uuid NOT NULL, operation text NOT NULL CHECK (operation IN ('UPSERT','DELETE')),
  entity_version bigint, occurred_at timestamptz NOT NULL, payload jsonb, received_at timestamptz NOT NULL DEFAULT now()
);
-- Remaining credit, supplier, expense, staff and order tables follow the same contract:
-- globally unique UUID id + shop_id + device_id + timestamptz + monotonically increasing version.
