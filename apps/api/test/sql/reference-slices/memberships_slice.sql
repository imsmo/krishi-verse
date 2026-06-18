-- apps/api/test/sql/reference-slices/memberships_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained overview of the membership tables (db/migrations 0015: membership_tiers +
-- user_memberships) + their tenant RLS (backfilled by 0020), WITHOUT the full 250-table platform. The
-- actual memberships integration test builds its DB from the REAL db/migrations + db/seeds — this is a sketch.
--
-- Flow: an admin defines tiers (free or paid; tenant-owned OR platform-standard when tenant_id IS NULL);
-- a user subscribes → for a paid tier the WALLET is debited (userMain → platform fees) and the membership
-- goes active with a current_period_end; an expiry job lapses it past the period. No version column.
BEGIN;
DROP TABLE IF EXISTS user_memberships, membership_tiers, roles, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE roles   (id uuid PRIMARY KEY, code varchar(40) NOT NULL);

CREATE TABLE membership_tiers (   -- tenant_id NULL = platform-standard (global); NO version column
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), code varchar(40) NOT NULL,
  default_name varchar(120) NOT NULL, audience_role_id uuid REFERENCES roles(id),
  monthly_fee_minor bigint NOT NULL DEFAULT 0, annual_fee_minor bigint, currency_code char(3) NOT NULL DEFAULT 'INR',
  platform_fee_bps_override integer, benefits jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (tenant_id, code));

CREATE TABLE user_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id),
  tier_id uuid NOT NULL REFERENCES membership_tiers(id), status varchar(20) NOT NULL DEFAULT 'active',  -- active|past_due|cancelled|expired
  billing_cycle varchar(10) NOT NULL DEFAULT 'monthly', current_period_end date, payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: tenant-private (backfilled by migration 0020 — these 0015 tables postdated the 0014 auto-pass).
-- A NULL tenant_id (platform-standard tier) is visible to ALL tenants by the policy below.
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY; ALTER TABLE membership_tiers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_membership_tiers ON membership_tiers USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE user_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_memberships ON user_memberships USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
