-- apps/api/test/sql/reference-slices/requirements_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the reverse-marketplace tables (db/migrations 0005:
-- requirements + requirement_responses) + their tenant RLS, WITHOUT the full 250-table platform. The
-- actual requirements integration test builds its DB from the REAL db/migrations + db/seeds
-- (test/integration-global-setup.js) — this file is a handy single-file sketch + local sandbox.
--
-- Flow: a buyer POSTs a requirement (demand); sellers QUOTE (requirement_responses, one per seller via
-- the UNIQUE); the buyer accepts a quote -> requirement 'fulfilled' + quote 'accepted'; the order is
-- created downstream (orders, source='requirement', requirement_id) — NO money moves here.
BEGIN;
DROP TABLE IF EXISTS requirement_responses, requirements, listings, products, categories, units, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS requirement_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE requirement_status AS ENUM ('open','partially_matched','fulfilled','expired','closed');

CREATE TABLE tenants    (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users      (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE categories (id uuid PRIMARY KEY, tenant_id uuid);
CREATE TABLE products   (id uuid PRIMARY KEY, category_id uuid NOT NULL REFERENCES categories(id));
CREATE TABLE units      (code varchar(20) PRIMARY KEY, default_name varchar(60) NOT NULL);
-- listings: only the columns ListingService.getById reads (a quote names the seller's listing)
CREATE TABLE listings (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), seller_user_id uuid NOT NULL,
  product_id uuid NOT NULL, title varchar(250) NOT NULL, unit_code varchar(20) NOT NULL,
  price_minor bigint NOT NULL, status varchar(15) NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);

-- ---------- requirements (demand) — NO version column (add_std_columns) → mutations lock FOR UPDATE
CREATE TABLE requirements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  buyer_user_id uuid NOT NULL REFERENCES users(id), product_id uuid REFERENCES products(id), category_id uuid REFERENCES categories(id),
  title varchar(250) NOT NULL, quantity numeric(14,3) NOT NULL, unit_code varchar(20) NOT NULL REFERENCES units(code),
  budget_min_minor bigint, budget_max_minor bigint, currency_code char(3) NOT NULL DEFAULT 'INR',
  need_by date, delivery_pincode varchar(10), status requirement_status NOT NULL DEFAULT 'open', is_urgent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_requirements_open ON requirements(tenant_id, category_id) WHERE status='open';

CREATE TABLE requirement_responses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), requirement_id uuid NOT NULL REFERENCES requirements(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id), seller_user_id uuid NOT NULL REFERENCES users(id),
  listing_id uuid REFERENCES listings(id), quoted_price_minor bigint NOT NULL, quantity numeric(14,3) NOT NULL,
  valid_until timestamptz, message text, status varchar(20) NOT NULL DEFAULT 'submitted',  -- submitted|shortlisted|accepted|rejected|expired
  ai_match_score numeric(5,4),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (requirement_id, seller_user_id));   -- one quote per seller per requirement

-- RLS: both tables are tenant-private (the 0014 auto-pass covers them — they predate it).
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY; ALTER TABLE requirements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_requirements ON requirements USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE requirement_responses ENABLE ROW LEVEL SECURITY; ALTER TABLE requirement_responses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_requirement_responses ON requirement_responses USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE listings ENABLE ROW LEVEL SECURITY; ALTER TABLE listings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON listings USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
COMMIT;
