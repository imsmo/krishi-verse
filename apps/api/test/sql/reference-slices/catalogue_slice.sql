-- apps/api/test/sql/catalogue_slice.sql · self-contained schema for the catalogue integration
-- test (products + RLS). Mirrors db/migrations 0004 (+ infra deps) without the full platform.
-- RLS on products proves: platform-master (tenant_id NULL) is visible to all; a tenant's
-- private products are invisible to other tenants. Idempotent.
BEGIN;
DROP TABLE IF EXISTS product_attribute_values, product_batches, category_attributes, attribute_options,
  attribute_definitions, tenant_categories, products, categories, usage_counters, idempotency_keys,
  outbox_events, audit_log, subscriptions, plan_limits, plans, units, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE units (code varchar(20) PRIMARY KEY, name varchar(60) NOT NULL);
CREATE TABLE plans (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE plan_limits (plan_id uuid NOT NULL REFERENCES plans(id), limit_code varchar(60) NOT NULL, limit_value bigint NOT NULL, PRIMARY KEY (plan_id, limit_code));
CREATE TABLE subscriptions (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, plan_id uuid NOT NULL REFERENCES plans(id), status varchar(20) NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE usage_counters (tenant_id uuid NOT NULL, metric_code varchar(60) NOT NULL, period date NOT NULL, used_value bigint NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, metric_code, period));
CREATE TABLE idempotency_keys (key varchar(120) PRIMARY KEY, user_id uuid, endpoint varchar(200) NOT NULL, response_status integer, response_body jsonb, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours');
CREATE TABLE outbox_events (id bigserial PRIMARY KEY, tenant_id uuid, aggregate_type varchar(60) NOT NULL, aggregate_id uuid NOT NULL, event_type varchar(120) NOT NULL, payload jsonb NOT NULL, status varchar(15) NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz);
CREATE TABLE audit_log (id bigserial, tenant_id uuid, actor_user_id uuid, actor_role varchar(40), action varchar(120) NOT NULL, entity_type varchar(60), entity_id uuid, old_value jsonb, new_value jsonb, reason text, ip inet, user_agent varchar(300), request_id varchar(60), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at));

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), parent_id uuid REFERENCES categories(id), code varchar(80) UNIQUE NOT NULL,
  default_name varchar(150) NOT NULL, path ltree NOT NULL, depth smallint NOT NULL CHECK (depth BETWEEN 1 AND 5),
  commerce_kind varchar(30) NOT NULL DEFAULT 'goods', requires_license boolean NOT NULL DEFAULT false, requires_certificate boolean NOT NULL DEFAULT false,
  min_age smallint, is_active boolean NOT NULL DEFAULT true, sort_order smallint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_categories_path ON categories USING gist(path);

CREATE TABLE tenant_categories (tenant_id uuid NOT NULL REFERENCES tenants(id), category_id uuid NOT NULL REFERENCES categories(id), is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, PRIMARY KEY (tenant_id, category_id));

CREATE TABLE attribute_definitions (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(80) UNIQUE NOT NULL, default_name varchar(150) NOT NULL,
  data_type varchar(15) NOT NULL, unit_code varchar(20) REFERENCES units(code), validation jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE TABLE attribute_options (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), attribute_id uuid NOT NULL REFERENCES attribute_definitions(id), code varchar(80) NOT NULL, default_name varchar(150) NOT NULL, sort_order smallint NOT NULL DEFAULT 100, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (attribute_id, code));
CREATE TABLE category_attributes (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), category_id uuid NOT NULL REFERENCES categories(id), attribute_id uuid NOT NULL REFERENCES attribute_definitions(id),
  is_required boolean NOT NULL DEFAULT false, show_in_filters boolean NOT NULL DEFAULT false, show_on_card boolean NOT NULL DEFAULT false, condition jsonb, sort_order smallint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (category_id, attribute_id));

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), category_id uuid NOT NULL REFERENCES categories(id), code varchar(100) UNIQUE, default_name varchar(200) NOT NULL,
  brand_id uuid, default_unit varchar(20) NOT NULL REFERENCES units(code), gst_rate_pct numeric(5,2), hsn_code varchar(12),
  is_perishable boolean NOT NULL DEFAULT false, shelf_life_days integer, tenant_id uuid REFERENCES tenants(id), is_active boolean NOT NULL DEFAULT true, search_tsv tsvector,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_products_tsv ON products USING gin(search_tsv);
CREATE TABLE product_attribute_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), product_id uuid NOT NULL REFERENCES products(id), attribute_id uuid NOT NULL REFERENCES attribute_definitions(id),
  value_text text, value_number numeric(20,6), value_bool boolean, value_date date, option_id uuid REFERENCES attribute_options(id), UNIQUE (product_id, attribute_id));
CREATE TABLE product_batches (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), product_id uuid NOT NULL REFERENCES products(id), seller_user_id uuid,
  batch_no varchar(80) NOT NULL, mfg_date date, expiry_date date, mrp_minor bigint, currency_code char(3) NOT NULL DEFAULT 'INR', qty_received numeric(14,3) NOT NULL, qty_remaining numeric(14,3) NOT NULL, unit_code varchar(20) NOT NULL REFERENCES units(code), is_recalled boolean NOT NULL DEFAULT false, recall_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: products (platform NULL visible to all; tenant-private isolated), tenant_categories, product_batches
ALTER TABLE products ENABLE ROW LEVEL SECURITY; ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products USING (tenant_id IS NULL OR tenant_id = current_tenant_id()) WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE tenant_categories ENABLE ROW LEVEL SECURITY; ALTER TABLE tenant_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_categories USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY; ALTER TABLE product_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_batches USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY; ALTER TABLE usage_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_counters USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- seed: unit + active category + a PLATFORM product (tenant_id NULL, visible to all tenants)
INSERT INTO units (code, name) VALUES ('quintal','Quintal') ON CONFLICT DO NOTHING;
INSERT INTO categories (id, code, default_name, path, depth, is_active) VALUES ('00000000-0000-0000-0000-0000000000c1','crops','Crops','crops',1,true) ON CONFLICT DO NOTHING;
INSERT INTO products (id, category_id, default_name, default_unit, tenant_id, is_active, search_tsv)
  VALUES ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Wheat (platform master)','quintal', NULL, true, to_tsvector('simple','Wheat')) ON CONFLICT DO NOTHING;
COMMIT;
