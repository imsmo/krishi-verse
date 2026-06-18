-- apps/api/test/sql/reference-slices/disputes_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained, readable overview of the disputes tables (db/migrations 0005: disputes +
-- dispute_messages) + the who-can-dispute gate dispute_eligibility (db/migrations 0025) + their tenant
-- RLS, WITHOUT the full 250-table platform. The actual disputes integration test builds its DB from the
-- REAL db/migrations + db/seeds (test/integration-global-setup.js) — this is a single-file sketch + sandbox.
--
-- Flow: orders.order_delivered → an eligibility row (buyer+seller); a party raises a dispute against the
-- counterparty (resolved from eligibility, never client-supplied); parties message; a moderator resolves
-- (refund_*/replacement/rejected) and the decision is announced. NO money moves here.
BEGIN;
DROP TABLE IF EXISTS dispute_messages, disputes, dispute_eligibility, lookup_values, lookup_types, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;
DROP TYPE IF EXISTS dispute_status CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE dispute_status AS ENUM ('open','seller_responded','under_review','escalated','resolved','rejected','withdrawn');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE lookup_types  (code varchar(60) PRIMARY KEY, default_name varchar(150) NOT NULL);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60) NOT NULL REFERENCES lookup_types(code), tenant_id uuid, code varchar(80) NOT NULL, default_name varchar(150) NOT NULL);

-- dispute_eligibility (0025): who-can-dispute gate — one row per delivered order
CREATE TABLE dispute_eligibility (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  order_id uuid NOT NULL, buyer_user_id uuid NOT NULL REFERENCES users(id), seller_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (order_id));
CREATE INDEX idx_dispute_eligibility_order ON dispute_eligibility(tenant_id, order_id);

-- disputes (0005): NO version column → mutations lock FOR UPDATE
CREATE TABLE disputes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), order_id uuid NOT NULL,
  raised_by uuid NOT NULL REFERENCES users(id), against_user uuid NOT NULL REFERENCES users(id),
  reason_id uuid NOT NULL REFERENCES lookup_values(id), description text, status dispute_status NOT NULL DEFAULT 'open',
  seller_respond_by timestamptz, ai_triage jsonb, resolution_type varchar(30), resolution_amount_minor bigint,
  resolution_txn_id uuid, resolved_by uuid REFERENCES users(id), resolved_at timestamptz, sla_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_disputes_tenant_open ON disputes(tenant_id, status) WHERE status NOT IN ('resolved','rejected','withdrawn');
CREATE INDEX idx_disputes_order ON disputes(order_id);

CREATE TABLE dispute_messages (   -- threaded evidence (append-only)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), dispute_id uuid NOT NULL REFERENCES disputes(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  author_user_id uuid NOT NULL REFERENCES users(id), body text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_dispute_msgs ON dispute_messages(dispute_id, created_at);

-- RLS: all tenant-private (disputes/messages via the 0014 auto-pass; dispute_eligibility via 0025).
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY; ALTER TABLE disputes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_disputes ON disputes USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY; ALTER TABLE dispute_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dispute_messages ON dispute_messages USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
ALTER TABLE dispute_eligibility ENABLE ROW LEVEL SECURITY; ALTER TABLE dispute_eligibility FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dispute_eligibility ON dispute_eligibility USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
