-- apps/api/test/sql/reference-slices/schemes_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the schemes spine (db/migrations/0011) — scheme_authorities + schemes (GLOBAL
-- reference) + scheme_applications + scheme_application_events (partitioned) + dbt_transfers (partitioned) —
-- plus tenant RLS. The real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: farmer checks eligibility against a scheme's machine-readable rules → applies (draft snapshots the
-- scheme version) → submits (collects the optional processing fee: applicant → tenant) → officer verifies →
-- approves/rejects → records the observed PFMS/DBT credit (no in-platform money). Every transition appends to
-- the partitioned audit trail. schemes/authorities have NO tenant_id (global, outside RLS).
BEGIN;
DROP TABLE IF EXISTS dbt_transfers, scheme_application_events, scheme_applications, schemes, scheme_authorities, lookup_values, admin_regions, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS application_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE application_status AS ENUM ('draft','submitted','under_verification','clarification_needed','approved','rejected','disbursed','closed','appealed');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE admin_regions (id uuid PRIMARY KEY, code varchar(20));
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(40), tenant_id uuid, code varchar(40), is_active boolean NOT NULL DEFAULT true);

CREATE TABLE scheme_authorities (  -- GLOBAL (no tenant_id)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), default_name varchar(200) NOT NULL, level varchar(15) NOT NULL CHECK (level IN ('central','state','district','body')), region_id uuid REFERENCES admin_regions(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE schemes (  -- GLOBAL catalogue (no tenant_id); processing_fee_minor bigint
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(60) UNIQUE NOT NULL, default_name varchar(250) NOT NULL, authority_id uuid NOT NULL REFERENCES scheme_authorities(id),
  category_id uuid NOT NULL REFERENCES lookup_values(id), benefit_summary jsonb NOT NULL, eligibility_rules jsonb NOT NULL, required_doc_type_ids jsonb NOT NULL DEFAULT '[]',
  application_window jsonb, applicable_region_ids jsonb NOT NULL DEFAULT '[]', processing_fee_minor bigint NOT NULL DEFAULT 0, source_url varchar(400), version integer NOT NULL DEFAULT 1, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE scheme_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), scheme_id uuid NOT NULL REFERENCES schemes(id), scheme_version integer NOT NULL,
  applicant_user_id uuid NOT NULL REFERENCES users(id), assisted_by uuid REFERENCES users(id), status application_status NOT NULL DEFAULT 'draft', form_data jsonb NOT NULL DEFAULT '{}',
  govt_app_ref varchar(120), eligibility_check jsonb, submitted_at timestamptz, decided_at timestamptz, rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE scheme_application_events (  -- PARTITIONED by created_at
  id uuid NOT NULL DEFAULT uuid_generate_v7(), application_id uuid NOT NULL, tenant_id uuid NOT NULL, from_status application_status, to_status application_status NOT NULL,
  note text, actor_user_id uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE scheme_application_events_default PARTITION OF scheme_application_events DEFAULT;

CREATE TABLE dbt_transfers (  -- PARTITIONED by created_at; observed PFMS credit RECORD (no wallet movement)
  id uuid NOT NULL DEFAULT uuid_generate_v7(), tenant_id uuid, application_id uuid, user_id uuid NOT NULL, scheme_id uuid NOT NULL, amount_minor bigint NOT NULL, instalment_no smallint,
  credited_on date NOT NULL, pfms_ref varchar(120), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE dbt_transfers_default PARTITION OF dbt_transfers DEFAULT;

-- RLS: the tenant-scoped tables are private to their tenant (Law 1). schemes/authorities are global → no RLS.
ALTER TABLE scheme_applications       ENABLE ROW LEVEL SECURITY; ALTER TABLE scheme_applications       FORCE ROW LEVEL SECURITY;
ALTER TABLE scheme_application_events ENABLE ROW LEVEL SECURITY; ALTER TABLE scheme_application_events FORCE ROW LEVEL SECURITY;
ALTER TABLE dbt_transfers             ENABLE ROW LEVEL SECURITY; ALTER TABLE dbt_transfers             FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_sa  ON scheme_applications       USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_sae ON scheme_application_events USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_dbt ON dbt_transfers             USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
