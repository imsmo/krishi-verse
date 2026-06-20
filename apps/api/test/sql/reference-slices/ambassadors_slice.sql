-- apps/api/test/sql/reference-slices/ambassadors_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the ambassador spine (db/migrations/0013) — ambassador_profiles +
-- commission_plans_ambassador + ambassador_earnings (PARTITIONED) + referrals — plus tenant RLS. The real
-- integration test builds its DB from the REAL db/migrations + db/seeds (incl. the 7 seeded commission streams).
--
-- Flow: an admin enrols an ambassador → anyone mints a referral code → a new user claims it (invited→signed_up)
-- → admin activates (→activated) → if the referrer is an ambassador, an earning accrues (resolve plan → compute
-- amount flat/rate×base capped). Sales by referred farmers accrue too. Earnings are ledgered (no wallet) and
-- settled weekly: ONE zero-sum 'commission' wallet transfer per ambassador, stamping payout_id. commission plans
-- may be platform-global (tenant_id NULL).
BEGIN;
DROP TABLE IF EXISTS referrals, ambassador_earnings, commission_plans_ambassador, ambassador_profiles, lookup_values, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60), code varchar(60));

CREATE TABLE ambassador_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL UNIQUE REFERENCES users(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  cluster_region_ids jsonb NOT NULL DEFAULT '[]', tier_id uuid REFERENCES lookup_values(id), mentor_ambassador_id uuid REFERENCES ambassador_profiles(id),
  training_completed_at timestamptz, kiosk_enabled boolean NOT NULL DEFAULT false, aeps_enabled boolean NOT NULL DEFAULT false, monthly_stipend_minor bigint NOT NULL DEFAULT 0,
  last_activity_at timestamptz, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE commission_plans_ambassador (  -- tenant_id NULL = platform default
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), event_code varchar(60) NOT NULL, amount_minor bigint, rate_bps integer, cap_minor bigint,
  conditions jsonb NOT NULL DEFAULT '{}', effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE ambassador_earnings (  -- PARTITIONED by created_at; append-only; payout_id NULL = unpaid
  id uuid NOT NULL DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL, ambassador_id uuid NOT NULL, plan_id uuid NOT NULL, event_code varchar(60) NOT NULL,
  reference_type varchar(50), reference_id uuid, amount_minor bigint NOT NULL, payout_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at), UNIQUE (ambassador_id, event_code, reference_id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE ambassador_earnings_default PARTITION OF ambassador_earnings DEFAULT;
CREATE INDEX idx_amb_earn_unpaid ON ambassador_earnings(ambassador_id) WHERE payout_id IS NULL;

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), referrer_user_id uuid NOT NULL REFERENCES users(id), referee_user_id uuid REFERENCES users(id),
  code varchar(20) NOT NULL, status varchar(20) NOT NULL DEFAULT 'invited', reward_rule jsonb NOT NULL DEFAULT '{}', reward_txn_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (tenant_id, code, referee_user_id));

-- RLS: tenant-scoped tables private to their tenant; commission plans allow NULL (platform default).
ALTER TABLE ambassador_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE ambassador_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE ambassador_earnings ENABLE ROW LEVEL SECURITY; ALTER TABLE ambassador_earnings FORCE ROW LEVEL SECURITY;
ALTER TABLE referrals           ENABLE ROW LEVEL SECURITY; ALTER TABLE referrals           FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_plans_ambassador ENABLE ROW LEVEL SECURITY; ALTER TABLE commission_plans_ambassador FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_ap  ON ambassador_profiles USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_ae  ON ambassador_earnings USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_ref ON referrals           USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_cpa ON commission_plans_ambassador USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
