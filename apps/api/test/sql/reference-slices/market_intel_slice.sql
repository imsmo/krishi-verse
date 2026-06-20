-- apps/api/test/sql/reference-slices/market_intel_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the Mandi Pulse spine (db/migrations/0013) — mandis + mandi_prices (PARTITIONED) +
-- price_predictions (PARTITIONED) + price_alerts — plus tenant RLS. The real integration test builds its DB from
-- the REAL db/migrations + db/seeds.
--
-- Flow: ops ingests price observations (mandi_prices, GLOBAL, append-only) → a baseline band (price_predictions,
-- GLOBAL) is computed from recent modals → a farmer subscribes to a threshold (price_alerts, TENANT-scoped) →
-- an ingest crossing the threshold fires the alert. mandis/mandi_prices/predictions are GLOBAL (no tenant_id, no
-- RLS); only price_alerts is tenant-scoped + RLS-protected.
BEGIN;
DROP TABLE IF EXISTS price_alerts, price_predictions, mandi_prices, mandis, products, admin_regions, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE admin_regions (id uuid PRIMARY KEY, code varchar(20));
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT uuid_generate_v7());

CREATE TABLE mandis (  -- GLOBAL reference (no tenant_id)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), default_name varchar(200) NOT NULL, region_id uuid REFERENCES admin_regions(id), mandi_code varchar(40) UNIQUE, lat numeric(9,6), lng numeric(9,6), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE mandi_prices (  -- GLOBAL, PARTITIONED by price_date (billions of rows)
  id bigserial, mandi_id uuid, region_id uuid, product_id uuid NOT NULL, grade_option_id uuid, price_date date NOT NULL,
  min_minor bigint, max_minor bigint, modal_minor bigint NOT NULL, unit_code varchar(20) NOT NULL DEFAULT 'quintal', arrivals_qty numeric(14,2), source varchar(40) NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR',
  PRIMARY KEY (id, price_date)) PARTITION BY RANGE (price_date);
CREATE TABLE mandi_prices_default PARTITION OF mandi_prices DEFAULT;
CREATE INDEX idx_mandi_prices_lookup ON mandi_prices(product_id, region_id, price_date DESC);

CREATE TABLE price_predictions (  -- GLOBAL, PARTITIONED by created_at
  id bigserial, product_id uuid NOT NULL, region_id uuid NOT NULL, grade_option_id uuid, target_date date NOT NULL,
  p10_minor bigint NOT NULL, p50_minor bigint NOT NULL, p90_minor bigint NOT NULL, confidence numeric(5,4), model_version varchar(20) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE price_predictions_default PARTITION OF price_predictions DEFAULT;

CREATE TABLE price_alerts (  -- TENANT-scoped, user-owned
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), product_id uuid NOT NULL REFERENCES products(id),
  region_id uuid REFERENCES admin_regions(id), direction varchar(6) NOT NULL CHECK (direction IN ('above','below')), threshold_minor bigint NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_price_alerts ON price_alerts(product_id, region_id) WHERE is_active;

-- RLS: only price_alerts is tenant-scoped (the others are global market data, no tenant_id → no RLS).
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY; ALTER TABLE price_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_alert ON price_alerts USING (tenant_id = current_tenant_id());
COMMIT;
