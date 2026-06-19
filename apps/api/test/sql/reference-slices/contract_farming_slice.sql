-- apps/api/test/sql/reference-slices/contract_farming_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the contract-farming spine (db/migrations/0010) — contract_templates,
-- farming_contracts, contract_growers, contract_milestones, contract_input_advances — plus tenant RLS,
-- WITHOUT the full platform. The real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: a buyer creates a fixed-price contract (draft→proposed→signed→active), enrols growers, disburses
-- INPUT ADVANCES (buyer → grower wallet), and at harvest SETTLES each grower (pay delivered qty × price,
-- recovering outstanding advances; buyer → grower for the net). Templates may be platform-standard (NULL
-- tenant, cross-tenant visible). No version columns → mutations lock FOR UPDATE.
BEGIN;
DROP TABLE IF EXISTS contract_input_advances, contract_milestones, contract_growers, farming_contracts, contract_templates, products, units, categories, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS contract_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE contract_status AS ENUM ('draft','proposed','negotiating','signed','active','fulfilled','breached','terminated','disputed');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE units   (code varchar(20) PRIMARY KEY);
CREATE TABLE categories (id uuid PRIMARY KEY);
CREATE TABLE products(id uuid PRIMARY KEY);

CREATE TABLE contract_templates (  -- tenant_id NULL = platform-standard (Model Act 2018), cross-tenant visible
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), default_name varchar(200) NOT NULL, category_id uuid REFERENCES categories(id),
  body_template text NOT NULL, clauses jsonb NOT NULL DEFAULT '[]', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE farming_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), contract_no varchar(40) NOT NULL, template_id uuid REFERENCES contract_templates(id),
  buyer_user_id uuid NOT NULL REFERENCES users(id), contract_kind varchar(20) NOT NULL CHECK (contract_kind IN ('pre_sowing','forward','tripartite')),
  product_id uuid NOT NULL REFERENCES products(id), total_quantity numeric(14,3) NOT NULL, unit_code varchar(20) NOT NULL REFERENCES units(code),
  price_model varchar(20) NOT NULL CHECK (price_model IN ('fixed','floor_ceiling','formula')), price_terms jsonb NOT NULL, quality_spec jsonb NOT NULL DEFAULT '{}',
  financier_partner_id uuid, season varchar(40), status contract_status NOT NULL DEFAULT 'draft', esign_envelope_ref varchar(200), signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE contract_growers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), contract_id uuid NOT NULL REFERENCES farming_contracts(id), tenant_id uuid NOT NULL,
  farmer_user_id uuid NOT NULL REFERENCES users(id), land_parcel_id uuid, committed_quantity numeric(14,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (contract_id, farmer_user_id, land_parcel_id));

CREATE TABLE contract_milestones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), contract_id uuid NOT NULL REFERENCES farming_contracts(id), grower_id uuid REFERENCES contract_growers(id), tenant_id uuid NOT NULL,
  milestone_type varchar(30) NOT NULL, due_on date, completed_at timestamptz, evidence_media_id uuid, data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE contract_input_advances (  -- buyer-supplied inputs; value/recovered are bigint minor units
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), contract_id uuid NOT NULL REFERENCES farming_contracts(id), grower_id uuid NOT NULL REFERENCES contract_growers(id), tenant_id uuid NOT NULL,
  product_id uuid REFERENCES products(id), description varchar(250), value_minor bigint NOT NULL, recovered_minor bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: tenant-private rows + platform-global (NULL tenant) templates visible to all (matches 0014 auto policy).
ALTER TABLE contract_templates      ENABLE ROW LEVEL SECURITY; ALTER TABLE contract_templates      FORCE ROW LEVEL SECURITY;
ALTER TABLE farming_contracts       ENABLE ROW LEVEL SECURITY; ALTER TABLE farming_contracts       FORCE ROW LEVEL SECURITY;
ALTER TABLE contract_growers        ENABLE ROW LEVEL SECURITY; ALTER TABLE contract_growers        FORCE ROW LEVEL SECURITY;
ALTER TABLE contract_milestones     ENABLE ROW LEVEL SECURITY; ALTER TABLE contract_milestones     FORCE ROW LEVEL SECURITY;
ALTER TABLE contract_input_advances ENABLE ROW LEVEL SECURITY; ALTER TABLE contract_input_advances FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_tpl  ON contract_templates      USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_fc   ON farming_contracts       USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_cg   ON contract_growers        USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_cm   ON contract_milestones     USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_cia  ON contract_input_advances USING (tenant_id = current_tenant_id());
COMMIT;
