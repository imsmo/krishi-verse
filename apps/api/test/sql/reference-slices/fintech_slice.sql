-- apps/api/test/sql/reference-slices/fintech_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the fintech LENDING spine (db/migrations/0011) — financial_partners +
-- loan_products (GLOBAL reference) + loan_applications + loans + loan_repayments (partitioned) — plus tenant
-- RLS. The real integration test builds its DB from the REAL db/migrations + db/seeds (incl. ensure_partitions).
--
-- Flow: borrower applies for a partner loan product → lender reviews → approves (cooling-off window) →
-- DISBURSES (tenant 'main' → borrower userMain) opening a servicing loan → borrower REPAYS (borrower →
-- tenant 'main') until outstanding hits zero and the loan closes. financial_partners + loan_products have NO
-- tenant_id (global, outside RLS). No version columns → mutations lock FOR UPDATE.
BEGIN;
DROP TABLE IF EXISTS loan_repayments, loans, loan_applications, loan_products, financial_partners, lookup_values, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS loan_app_status CASCADE; DROP TYPE IF EXISTS loan_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE loan_app_status AS ENUM ('draft','submitted','docs_pending','under_review','approved','rejected','withdrawn','disbursed','closed');
CREATE TYPE loan_status     AS ENUM ('active','overdue','restructured','closed','written_off','transferred');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(40), tenant_id uuid, code varchar(40), is_active boolean NOT NULL DEFAULT true);

CREATE TABLE financial_partners (  -- GLOBAL lender registry (no tenant_id)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), code varchar(60) UNIQUE NOT NULL, default_name varchar(200) NOT NULL,
  partner_kind varchar(20) NOT NULL CHECK (partner_kind IN ('bank','nbfc','mfi','insurer','amc','gold_loan')), regulator_ref varchar(60), api_provider_code varchar(60), sla jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE loan_products (  -- GLOBAL product catalog (no tenant_id); amounts bigint minor units
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), partner_id uuid NOT NULL REFERENCES financial_partners(id), product_kind_id uuid NOT NULL REFERENCES lookup_values(id),
  default_name varchar(200) NOT NULL, currency_code char(3) NOT NULL DEFAULT 'INR', min_amount_minor bigint NOT NULL, max_amount_minor bigint NOT NULL,
  interest_apr_bps integer NOT NULL, subvention_bps integer NOT NULL DEFAULT 0, tenure_months_min smallint, tenure_months_max smallint, ltv_bps integer,
  collateral_kind varchar(30), origination_fee_minor bigint NOT NULL DEFAULT 0, origination_fee_bps integer NOT NULL DEFAULT 0, eligibility_rules jsonb NOT NULL DEFAULT '{}',
  required_doc_type_ids jsonb NOT NULL DEFAULT '[]', repayment_style varchar(20) NOT NULL DEFAULT 'emi', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE loan_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), applicant_user_id uuid NOT NULL REFERENCES users(id),
  product_id uuid NOT NULL REFERENCES loan_products(id), amount_requested_minor bigint NOT NULL, purpose_text varchar(300), status loan_app_status NOT NULL DEFAULT 'draft',
  credit_score_id uuid, group_id uuid, nwr_id uuid, partner_app_ref varchar(120), decision_at timestamptz, decision_note text, amount_approved_minor bigint, cooling_off_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), application_id uuid NOT NULL UNIQUE REFERENCES loan_applications(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  borrower_user_id uuid NOT NULL REFERENCES users(id), partner_id uuid NOT NULL REFERENCES financial_partners(id), principal_minor bigint NOT NULL, interest_apr_bps integer NOT NULL,
  disbursed_at date NOT NULL, maturity_date date, status loan_status NOT NULL DEFAULT 'active', outstanding_minor bigint NOT NULL, next_due_date date, origination_fee_txn_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE loan_repayments (  -- PARTITIONED by created_at
  id uuid NOT NULL DEFAULT uuid_generate_v7(), loan_id uuid NOT NULL, tenant_id uuid NOT NULL, due_date date NOT NULL, amount_due_minor bigint NOT NULL,
  amount_paid_minor bigint NOT NULL DEFAULT 0, paid_at timestamptz, channel varchar(30), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE loan_repayments_default PARTITION OF loan_repayments DEFAULT;

-- RLS: the three tenant tables are private to their tenant (Law 1). partners/products are global → no RLS.
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY; ALTER TABLE loan_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE loans             ENABLE ROW LEVEL SECURITY; ALTER TABLE loans             FORCE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments   ENABLE ROW LEVEL SECURITY; ALTER TABLE loan_repayments   FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_la ON loan_applications USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_ln ON loans             USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_lr ON loan_repayments   USING (tenant_id = current_tenant_id());
COMMIT;
