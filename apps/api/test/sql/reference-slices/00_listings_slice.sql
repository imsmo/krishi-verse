-- apps/api/test/sql/00_listings_slice.sql
-- SELF-CONTAINED schema for the listings vertical slice (integration tests + local
-- dev). It mirrors the relevant tables from Database_Architecture/full_platform
-- (commerce + platform-ops) but WITHOUT the 250-table platform's cross-FKs, so a
-- fresh Postgres can stand the slice up in one file. RLS is enabled exactly as in
-- production so the integration test proves real tenant isolation.
-- Idempotent: safe to re-run.
BEGIN;

DROP TABLE IF EXISTS listing_media, listing_attribute_values, listing_price_history,
  listings, outbox_events, idempotency_keys, usage_counters, plan_limits,
  subscriptions, plans CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;

-- Tenant resolver used by RLS policies (set per-tx by the app: SET LOCAL app.tenant_id).
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='listing_status') THEN
    CREATE TYPE listing_status AS ENUM
      ('draft','pending_approval','published','paused','sold_out','expired','rejected','hidden','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='sale_type') THEN
    CREATE TYPE sale_type AS ENUM ('direct','auction','both','preorder','service','group_lot');
  END IF;
END $$;

CREATE TABLE plans (
  id uuid PRIMARY KEY,
  name varchar(60) NOT NULL
);

CREATE TABLE plan_limits (
  plan_id uuid NOT NULL REFERENCES plans(id),
  limit_code varchar(60) NOT NULL,
  limit_value bigint NOT NULL,          -- -1 = unlimited
  PRIMARY KEY (plan_id, limit_code)
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_counters (
  tenant_id uuid NOT NULL,
  metric_code varchar(60) NOT NULL,
  period date NOT NULL,
  used_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, metric_code, period)
);

CREATE TABLE idempotency_keys (
  key varchar(120) PRIMARY KEY,
  user_id uuid,
  endpoint varchar(200) NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE TABLE outbox_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid,
  aggregate_type varchar(60) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(120) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE listings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  category_id uuid NOT NULL,
  title varchar(250) NOT NULL,
  description text,
  quantity_total numeric(14,3) NOT NULL CHECK (quantity_total > 0),
  quantity_available numeric(14,3) NOT NULL,
  min_order_qty numeric(14,3) NOT NULL DEFAULT 0,
  unit_code varchar(20) NOT NULL,
  price_minor bigint NOT NULL CHECK (price_minor > 0),
  currency_code char(3) NOT NULL DEFAULT 'INR',
  organic_claim varchar(20) NOT NULL DEFAULT 'none',
  status listing_status NOT NULL DEFAULT 'draft',
  sale_type sale_type NOT NULL DEFAULT 'direct',
  pincode varchar(10),
  region_id uuid,
  lat numeric(9,6),
  lng numeric(9,6),
  visibility varchar(20) NOT NULL DEFAULT 'tenant',
  ai_extracted boolean NOT NULL DEFAULT false,
  publish_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_listings_tenant_status ON listings (tenant_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_seller ON listings (tenant_id, seller_user_id, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE listing_attribute_values (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES listings(id),
  attribute_id uuid NOT NULL,
  value_text text, value_number numeric(20,6), value_bool boolean, value_date date, option_id uuid,
  UNIQUE (listing_id, attribute_id)
);

CREATE TABLE listing_price_history (
  id uuid NOT NULL,
  listing_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  old_price_minor bigint,
  new_price_minor bigint NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
);

CREATE TABLE listing_media (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES listings(id),
  media_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, media_id)
);

-- ---- Row-Level Security: tenant isolation enforced by the database (Law 1) ----
ALTER TABLE listings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings                 FORCE  ROW LEVEL SECURITY;
ALTER TABLE listing_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_attribute_values FORCE  ROW LEVEL SECURITY;
ALTER TABLE listing_price_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_price_history    FORCE  ROW LEVEL SECURITY;
ALTER TABLE listing_media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_media            FORCE  ROW LEVEL SECURITY;
ALTER TABLE usage_counters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters           FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON listings
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON listing_attribute_values
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON listing_price_history
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON listing_media
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON usage_counters
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

COMMIT;
