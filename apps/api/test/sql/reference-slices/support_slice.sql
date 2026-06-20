-- apps/api/test/sql/reference-slices/support_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the support spine (db/migrations/0012) — support_tickets — plus tenant RLS. The
-- real integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: a requester opens a ticket (SLA due dates derived from severity) → an agent assigns, responds (stamps
-- first_responded_at), drives the status machine (open↔pending_*↔escalated→resolved→closed, +reopened) → the
-- requester rates it (CSAT 1-5). An escalated dispute auto-opens a P1 ticket (idempotent by ticket_no). Money-free.
BEGIN;
DROP TABLE IF EXISTS support_tickets, conversations, lookup_values, users, tenants CASCADE;
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE ticket_status AS ENUM ('open','pending_customer','pending_internal','escalated','resolved','closed','reopened');

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60), code varchar(60));
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT uuid_generate_v7());

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), ticket_no varchar(40) NOT NULL UNIQUE,
  requester_user_id uuid REFERENCES users(id), channel varchar(20) NOT NULL, category_id uuid REFERENCES lookup_values(id),
  severity varchar(5) NOT NULL DEFAULT 'P2' CHECK (severity IN ('P0','P1','P2','P3')), subject varchar(250), status ticket_status NOT NULL DEFAULT 'open',
  assignee_user_id uuid REFERENCES users(id), conversation_id uuid REFERENCES conversations(id),
  sla_first_response_due timestamptz, sla_resolution_due timestamptz, first_responded_at timestamptz, resolved_at timestamptz, csat_score smallint CHECK (csat_score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_tickets_open ON support_tickets(tenant_id, status, severity) WHERE status NOT IN ('resolved','closed');
CREATE INDEX idx_tickets_assignee ON support_tickets(assignee_user_id) WHERE status NOT IN ('resolved','closed');

-- RLS: tickets are private to their tenant (Law 1). NULL tenant_id = platform-level support (visible to all).
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY; ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_support ON support_tickets USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
