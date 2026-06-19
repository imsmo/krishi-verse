-- apps/api/test/sql/reference-slices/dairy_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the dairy MILK-PROCUREMENT spine (db/migrations/0009) — mcc_centres,
-- dairy_memberships, milk_rate_cards, milk_collections (PARTITIONED), milk_bills — plus tenant RLS,
-- WITHOUT the full platform or deferred tables (bmc/coop/d2c). The real integration test builds its DB
-- from the REAL db/migrations + db/seeds (incl. ensure_partitions); this is a map.
--
-- Flow: a cooperative runs an MCC, enrols a farmer (membership), defines a quality rate card, records
-- twice-daily collections (priced float-free → amount_minor), then per cycle generates a milk_bill
-- (gross − deductions = net), approves it, and PAYS the farmer the net via the wallet (tenant main →
-- farmer userMain). No version columns → mutations lock FOR UPDATE. milk_collections prunes by collected_on.
BEGIN;
DROP TABLE IF EXISTS milk_bills, milk_collections, milk_rate_cards, dairy_memberships, mcc_centres, admin_regions, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS milk_shift CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE milk_shift AS ENUM ('morning','evening');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE admin_regions (id uuid PRIMARY KEY, code varchar(20));

CREATE TABLE mcc_centres (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), code varchar(40) NOT NULL,
  default_name varchar(150) NOT NULL, region_id uuid REFERENCES admin_regions(id), lat numeric(9,6), lng numeric(9,6),
  operator_user_id uuid REFERENCES users(id), capacity_litres_shift numeric(10,2), analyzer_model varchar(100), analyzer_serial varchar(100), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (tenant_id, code));

CREATE TABLE dairy_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), farmer_user_id uuid NOT NULL REFERENCES users(id),
  mcc_id uuid NOT NULL REFERENCES mcc_centres(id), member_code varchar(40) NOT NULL,
  payment_cycle varchar(15) NOT NULL DEFAULT 'weekly' CHECK (payment_cycle IN ('daily','weekly','fortnightly','monthly')),
  default_animal_type varchar(10) CHECK (default_animal_type IN ('cow','buffalo','mixed')), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (tenant_id, mcc_id, member_code));

CREATE TABLE milk_rate_cards (   -- quality-based pricing; rates are bigint minor units
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), default_name varchar(120) NOT NULL,
  animal_type varchar(10) NOT NULL CHECK (animal_type IN ('cow','buffalo','mixed')),
  pricing_model varchar(20) NOT NULL CHECK (pricing_model IN ('two_axis','fat_pooled','snf_pooled')),
  rate_per_kg_fat_minor bigint, rate_per_kg_snf_minor bigint, base_rate_per_litre_minor bigint, bonus_rules jsonb NOT NULL DEFAULT '[]',
  effective_from date NOT NULL, effective_to date, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE milk_collections (  -- PARTITIONED by collected_on; UNIQUE(membership,collected_on,shift); amount_minor bigint
  id uuid NOT NULL DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL, mcc_id uuid NOT NULL, membership_id uuid NOT NULL,
  shift milk_shift NOT NULL, collected_on date NOT NULL, weight_kg numeric(8,3) NOT NULL, fat_pct numeric(4,2) NOT NULL, snf_pct numeric(4,2) NOT NULL,
  density numeric(6,3), water_flag boolean NOT NULL DEFAULT false, adulteration_flags jsonb NOT NULL DEFAULT '[]', rate_card_id uuid NOT NULL,
  amount_minor bigint NOT NULL, device_payload jsonb, entered_by uuid, milk_bill_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  PRIMARY KEY (id, collected_on), UNIQUE (membership_id, collected_on, shift)) PARTITION BY RANGE (collected_on);
CREATE TABLE milk_collections_default PARTITION OF milk_collections DEFAULT;

CREATE TABLE milk_bills (        -- per-cycle settlement → wallet payout. net = gross − deductions
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), membership_id uuid NOT NULL REFERENCES dairy_memberships(id),
  period_start date NOT NULL, period_end date NOT NULL, total_litres numeric(10,2) NOT NULL, gross_minor bigint NOT NULL,
  deductions jsonb NOT NULL DEFAULT '[]', deductions_minor bigint NOT NULL DEFAULT 0, net_minor bigint NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft', dispute_window_ends timestamptz, payout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (membership_id, period_start, period_end));

-- RLS: every tenant table is private to its tenant (Law 1).
ALTER TABLE mcc_centres       ENABLE ROW LEVEL SECURITY; ALTER TABLE mcc_centres       FORCE ROW LEVEL SECURITY;
ALTER TABLE dairy_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE dairy_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE milk_rate_cards   ENABLE ROW LEVEL SECURITY; ALTER TABLE milk_rate_cards   FORCE ROW LEVEL SECURITY;
ALTER TABLE milk_collections  ENABLE ROW LEVEL SECURITY; ALTER TABLE milk_collections  FORCE ROW LEVEL SECURITY;
ALTER TABLE milk_bills        ENABLE ROW LEVEL SECURITY; ALTER TABLE milk_bills        FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_mcc  ON mcc_centres       USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_mem  ON dairy_memberships USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_rc   ON milk_rate_cards   USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_coll ON milk_collections  USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_bill ON milk_bills        USING (tenant_id = current_tenant_id());
COMMIT;
