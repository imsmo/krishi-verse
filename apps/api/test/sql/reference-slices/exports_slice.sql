-- apps/api/test/sql/reference-slices/exports_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the exports spine (db/migrations/0010) — exporter_registrations,
-- export_shipments, export_documents — + the GLOBAL compliance_requirements reference table, plus tenant
-- RLS. The real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: an exporter registers an RCMC/IEC, creates a shipment to a destination country, assembles a
-- document checklist (each pending→submitted→verified|rejected), and drives the shipment
-- draft→docs_in_progress→inspection→shipped→delivered→paid→closed — gated so it cannot SHIP until every
-- document is verified. compliance_requirements has NO tenant_id (global reference, outside RLS). No money.
BEGIN;
DROP TABLE IF EXISTS compliance_requirements, export_documents, export_shipments, exporter_registrations, lookup_values, categories, countries, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE countries (code char(2) PRIMARY KEY, default_name varchar(100) NOT NULL);
CREATE TABLE categories (id uuid PRIMARY KEY);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(40), tenant_id uuid, code varchar(40), is_active boolean NOT NULL DEFAULT true);

CREATE TABLE exporter_registrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), exporter_user_id uuid REFERENCES users(id),
  authority varchar(20) NOT NULL, reg_no varchar(60) NOT NULL, iec_code varchar(20), valid_until date, doc_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE export_shipments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), exporter_user_id uuid NOT NULL REFERENCES users(id),
  destination_country char(2) NOT NULL REFERENCES countries(code), incoterm varchar(10), status varchar(30) NOT NULL DEFAULT 'draft',
  order_ids jsonb NOT NULL DEFAULT '[]', vessel_or_awb varchar(80), lc_ref varchar(80), total_value_minor bigint, currency_code char(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE export_documents (  -- checklist; doc_type_id → lookup 'export_doc'
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), shipment_id uuid NOT NULL REFERENCES export_shipments(id), tenant_id uuid NOT NULL,
  doc_type_id uuid NOT NULL REFERENCES lookup_values(id), media_id uuid, status varchar(20) NOT NULL DEFAULT 'pending', reference_no varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE compliance_requirements (  -- GLOBAL reference data (no tenant_id) → outside RLS
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), destination_country char(2) NOT NULL REFERENCES countries(code), category_id uuid REFERENCES categories(id),
  requirement_code varchar(60) NOT NULL, rules jsonb NOT NULL, effective_from date NOT NULL, effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

-- RLS: the three tenant tables are private to their tenant (Law 1). compliance_requirements is global → no RLS.
ALTER TABLE exporter_registrations ENABLE ROW LEVEL SECURITY; ALTER TABLE exporter_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE export_shipments       ENABLE ROW LEVEL SECURITY; ALTER TABLE export_shipments       FORCE ROW LEVEL SECURITY;
ALTER TABLE export_documents       ENABLE ROW LEVEL SECURITY; ALTER TABLE export_documents       FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_er  ON exporter_registrations USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_es  ON export_shipments       USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_ed  ON export_documents        USING (tenant_id = current_tenant_id());
COMMIT;
