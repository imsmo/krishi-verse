-- apps/api/test/sql/orders_slice.sql · self-contained schema for the orders integration test
-- (cart → checkout → order lifecycle + RLS). Mirrors db/migrations 0005 (commerce) plus the
-- listings columns ListingService.getById reads, and the infra deps (quota/idempotency/outbox/
-- audit/feature_flags), WITHOUT the full platform. Tables are non-partitioned here (a single test
-- shard) but the uuid_v7_time() partition-prune function is real, so the repo's PRUNE clauses run
-- exactly as in production. RLS on orders/order_items/order_events/carts proves cross-tenant denial.
-- Idempotent.
BEGIN;
DROP TABLE IF EXISTS order_events, order_items, orders, checkout_groups, cart_items, carts,
  listings, feature_flags, usage_counters, idempotency_keys, outbox_events, audit_log,
  subscriptions, plan_limits, plans, units, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP FUNCTION IF EXISTS uuid_v7_time(uuid) CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
-- REAL v7 time-extractor (identical to migration 0001): the repo's partition-prune WHERE clauses
-- depend on it, so the test exercises the exact production query shape.
CREATE FUNCTION uuid_v7_time(u uuid) RETURNS timestamptz AS $$
SELECT to_timestamp((('x' || substring(replace(u::text,'-','') from 1 for 12))::bit(48)::bigint) / 1000.0);
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE units (code varchar(20) PRIMARY KEY, name varchar(60) NOT NULL);
CREATE TABLE plans (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE plan_limits (plan_id uuid NOT NULL REFERENCES plans(id), limit_code varchar(60) NOT NULL, limit_value bigint NOT NULL, PRIMARY KEY (plan_id, limit_code));
CREATE TABLE subscriptions (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, plan_id uuid NOT NULL REFERENCES plans(id), status varchar(20) NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE usage_counters (tenant_id uuid NOT NULL, metric_code varchar(60) NOT NULL, period date NOT NULL, used_value bigint NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, metric_code, period));
CREATE TABLE idempotency_keys (key varchar(120) PRIMARY KEY, user_id uuid, endpoint varchar(200) NOT NULL, response_status integer, response_body jsonb, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours');
CREATE TABLE outbox_events (id bigserial PRIMARY KEY, tenant_id uuid, aggregate_type varchar(60) NOT NULL, aggregate_id uuid NOT NULL, event_type varchar(120) NOT NULL, payload jsonb NOT NULL, status varchar(15) NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz);
CREATE TABLE audit_log (id bigserial, tenant_id uuid, actor_user_id uuid, actor_role varchar(40), action varchar(120) NOT NULL, entity_type varchar(60), entity_id uuid, old_value jsonb, new_value jsonb, reason text, ip inet, user_agent varchar(300), request_id varchar(60), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));
-- feature_flags: FlagsService reads this to decide the online_payments money path.
CREATE TABLE feature_flags (key varchar(80) PRIMARY KEY, description text, is_enabled boolean NOT NULL DEFAULT false, rollout_pct smallint NOT NULL DEFAULT 100, rules jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- listings: only the columns ListingService.getById (→ ListingRepository.findById/COLS) reads.
CREATE TABLE listings (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), seller_user_id uuid NOT NULL,
  product_id uuid NOT NULL, category_id uuid NOT NULL, title varchar(250) NOT NULL, description text,
  quantity_total numeric(14,3) NOT NULL, quantity_available numeric(14,3) NOT NULL, min_order_qty numeric(14,3) NOT NULL DEFAULT 1,
  unit_code varchar(20) NOT NULL, price_minor bigint NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR',
  organic_claim varchar(20) NOT NULL DEFAULT 'none', status varchar(15) NOT NULL DEFAULT 'published', sale_type varchar(15) NOT NULL DEFAULT 'fixed',
  pincode varchar(10), region_id uuid, lat double precision, lng double precision, visibility varchar(15) NOT NULL DEFAULT 'public',
  ai_extracted boolean NOT NULL DEFAULT false, publish_at timestamptz, published_at timestamptz, expires_at timestamptz, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);

CREATE TABLE carts (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL,
  status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, user_id, status));
CREATE TABLE cart_items (
  id uuid PRIMARY KEY, cart_id uuid NOT NULL REFERENCES carts(id), listing_id uuid NOT NULL REFERENCES listings(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0), added_price_minor bigint NOT NULL, UNIQUE (cart_id, listing_id));

CREATE TABLE checkout_groups (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), buyer_user_id uuid NOT NULL,
  total_minor bigint NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR', created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE orders (
  id uuid NOT NULL, tenant_id uuid NOT NULL, order_no varchar(40) NOT NULL, checkout_group_id uuid,
  buyer_user_id uuid NOT NULL, seller_user_id uuid NOT NULL, source varchar(20) NOT NULL DEFAULT 'direct',
  currency_code char(3) NOT NULL DEFAULT 'INR', subtotal_minor bigint NOT NULL, delivery_fee_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0, tax_minor bigint NOT NULL DEFAULT 0, commission_minor bigint NOT NULL DEFAULT 0,
  platform_fee_minor bigint NOT NULL DEFAULT 0, tds_minor bigint NOT NULL DEFAULT 0, total_minor bigint NOT NULL,
  status varchar(25) NOT NULL DEFAULT 'created', delivery_method_id uuid, delivery_address_id uuid,
  acceptance_deadline timestamptz, quality_window_ends timestamptz, cancel_reason_id uuid, cancelled_by uuid,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, PRIMARY KEY (id, created_at));
CREATE UNIQUE INDEX uq_orders_no ON orders(tenant_id, order_no, created_at);

CREATE TABLE order_items (
  id uuid NOT NULL, order_id uuid NOT NULL, order_created_at timestamptz NOT NULL, tenant_id uuid NOT NULL,
  listing_id uuid NOT NULL, product_id uuid NOT NULL, title_snapshot varchar(250) NOT NULL, quantity numeric(14,3) NOT NULL,
  delivered_quantity numeric(14,3), unit_code varchar(20) NOT NULL, unit_price_minor bigint NOT NULL, line_total_minor bigint NOT NULL,
  gst_rate_pct numeric(5,2), hsn_code varchar(12), batch_id uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_events (
  id uuid NOT NULL, tenant_id uuid NOT NULL, order_id uuid NOT NULL, from_status varchar(25), to_status varchar(25) NOT NULL,
  actor_user_id uuid, note text, meta jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at);

-- RLS: every commerce row is strictly tenant-scoped (no platform-NULL rows here).
ALTER TABLE listings ENABLE ROW LEVEL SECURITY; ALTER TABLE listings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON listings USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE carts ENABLE ROW LEVEL SECURITY; ALTER TABLE carts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON carts USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY; ALTER TABLE cart_items FORCE ROW LEVEL SECURITY;
CREATE POLICY cart_items_via_cart ON cart_items USING (EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id)) WITH CHECK (EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id));
ALTER TABLE checkout_groups ENABLE ROW LEVEL SECURITY; ALTER TABLE checkout_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON checkout_groups USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE orders ENABLE ROW LEVEL SECURITY; ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY; ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY; ALTER TABLE order_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_events USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY; ALTER TABLE usage_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_counters USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- seed: unit + the online_payments flag OFF (COD-style placement path is the test default).
INSERT INTO units (code, name) VALUES ('quintal','Quintal') ON CONFLICT DO NOTHING;
INSERT INTO feature_flags (key, description, is_enabled, rollout_pct) VALUES ('online_payments','online payment at checkout', false, 100) ON CONFLICT DO NOTHING;
COMMIT;
