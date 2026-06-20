-- apps/api/test/sql/reference-slices/messaging_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the messaging vertical of M13 (db/migrations/0012) — conversations +
-- conversation_participants + messages (PARTITIONED) + masked_calls (PARTITIONED) — plus tenant RLS. The real
-- integration test builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: a participant opens a conversation (order/dispute/direct…) → posts messages (append-only; emits an event
-- the notification spine turns into a push/in-app alert) → a moderator may lock the thread or flag a message.
-- A masked call bridges two users via an external provider; we store ONLY user ids + the provider's call ref +
-- duration — NEVER raw phone numbers. conversation_participants has no tenant_id (gated via the conversation join).
BEGIN;
DROP TABLE IF EXISTS masked_calls, messages, conversation_participants, conversations, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  context_type varchar(40) NOT NULL, context_id uuid, is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE conversation_participants (  -- no tenant_id; gated via the conversation join
  conversation_id uuid NOT NULL REFERENCES conversations(id), user_id uuid NOT NULL REFERENCES users(id),
  role varchar(20) NOT NULL DEFAULT 'member', last_read_at timestamptz, PRIMARY KEY (conversation_id, user_id));

CREATE TABLE messages (  -- append-only, PARTITIONED by created_at
  id uuid NOT NULL DEFAULT uuid_generate_v7(), conversation_id uuid NOT NULL, tenant_id uuid NOT NULL, sender_user_id uuid,
  body text, voice_media_id uuid, attachment_media_id uuid, is_ai_generated boolean NOT NULL DEFAULT false, is_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE messages_default PARTITION OF messages DEFAULT;
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);

CREATE TABLE masked_calls (  -- privacy-proxy log, PARTITIONED; NO raw phone numbers (only user ids + provider ref)
  id uuid NOT NULL DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL, caller_user_id uuid NOT NULL, callee_user_id uuid NOT NULL,
  context_type varchar(40), context_id uuid, provider_call_ref varchar(120), duration_secs integer, recording_media_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE masked_calls_default PARTITION OF masked_calls DEFAULT;

-- RLS: tenant-scoped tables are private to their tenant (Law 1). conversation_participants inherits isolation
-- through the conversation join (no tenant_id of its own).
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY; ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY; ALTER TABLE messages      FORCE ROW LEVEL SECURITY;
ALTER TABLE masked_calls  ENABLE ROW LEVEL SECURITY; ALTER TABLE masked_calls  FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_conv ON conversations USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_msg  ON messages      USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_call ON masked_calls  USING (tenant_id = current_tenant_id());
COMMIT;
