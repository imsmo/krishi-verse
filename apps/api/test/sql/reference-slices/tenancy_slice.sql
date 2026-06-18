-- apps/api/test/sql/reference-slices/tenancy_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained overview of the SaaS control-plane tables (db/migrations 0002: plans + plan_limits +
-- subscriptions; 0015: usage_counters) WITHOUT the full 250-table platform. The actual tenancy
-- integration test builds its DB from the REAL db/migrations + db/seeds — this is a sketch + sandbox.
--
-- The point: an ACTIVE subscription ⋈ plan_limits is what core QuotaService resolves a tenant's quotas
-- from, metered against usage_counters. plans/plan_limits are GLOBAL (no tenant_id; platform config);
-- subscriptions + usage_counters are tenant-scoped (RLS). No money moves here (SaaS billing is separate).
BEGIN;
DROP TABLE IF EXISTS usage_counters, subscriptions, plan_limits, plans, countries, currencies, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','paused','cancelled','expired');

CREATE TABLE tenants    (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE countries  (code char(2) PRIMARY KEY);
CREATE TABLE currencies (code char(3) PRIMARY KEY);

-- plans + plan_limits: GLOBAL platform config (no tenant_id; no RLS)
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(40) NOT NULL, version integer NOT NULL DEFAULT 1,
  default_name varchar(100) NOT NULL, country_code char(2) NOT NULL REFERENCES countries(code), currency_code char(3) NOT NULL REFERENCES currencies(code),
  monthly_price_minor bigint NOT NULL, annual_price_minor bigint NOT NULL, setup_fee_minor bigint NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (code, version, country_code));
CREATE TABLE plan_limits (
  plan_id uuid NOT NULL REFERENCES plans(id), limit_code varchar(60) NOT NULL, limit_value bigint NOT NULL,   -- -1 = unlimited
  PRIMARY KEY (plan_id, limit_code));

-- subscriptions: tenant-scoped (RLS). The status='active' row drives the tenant's quotas.
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), plan_id uuid NOT NULL REFERENCES plans(id),
  status subscription_status NOT NULL DEFAULT 'trialing', billing_cycle varchar(10) NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  price_minor bigint NOT NULL, currency_code char(3) NOT NULL REFERENCES currencies(code), discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  anchor_terms jsonb NOT NULL DEFAULT '{}', current_period_start date NOT NULL, current_period_end date NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false, cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE usage_counters (   -- metered usage per tenant per month (QuotaService increments here)
  tenant_id uuid NOT NULL REFERENCES tenants(id), metric_code varchar(60) NOT NULL, period date NOT NULL, used_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, metric_code, period));

-- RLS: tenant-private for the tenant tables (the 0014 auto-pass covers them — they have tenant_id).
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY; ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscriptions ON subscriptions USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY; ALTER TABLE usage_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_counters ON usage_counters USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
-- plans / plan_limits are GLOBAL: no tenant_id, no RLS (read by all; written only by platform admins in-app).
COMMIT;
