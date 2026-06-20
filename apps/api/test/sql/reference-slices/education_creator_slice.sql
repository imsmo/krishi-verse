-- apps/api/test/sql/reference-slices/education_creator_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the M09 creator-content layer (db/migrations/0027) — learning_channels +
-- learning_resources + live_sessions + live_session_registrations — plus tenant RLS. The real integration test
-- builds its DB from the REAL db/migrations + db/seeds.
--
-- Flow: a host registers an external channel (pending) → a tenant moderator approves it (the host-authority
-- gate) → the host publishes curated resources (auto-approved under their own approved channel) and schedules
-- live streaming sessions (scheduled→live→ended). registrations have no tenant_id (gated via the session join).
BEGIN;
DROP TABLE IF EXISTS live_session_registrations, live_sessions, learning_resources, learning_channels, lookup_values, media_assets, languages, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE languages (code varchar(8) PRIMARY KEY, name_english varchar(60));
CREATE TABLE media_assets (id uuid PRIMARY KEY DEFAULT uuid_generate_v7());
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60), code varchar(60));

CREATE TABLE learning_channels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), owner_user_id uuid NOT NULL REFERENCES users(id),
  provider varchar(20) NOT NULL, title varchar(200) NOT NULL, handle varchar(120), external_url varchar(500) NOT NULL, topic_id uuid REFERENCES lookup_values(id),
  description text, status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  review_note text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (tenant_id, provider, external_url));

CREATE TABLE learning_resources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), channel_id uuid REFERENCES learning_channels(id), owner_user_id uuid NOT NULL REFERENCES users(id),
  kind varchar(20) NOT NULL CHECK (kind IN ('video','blog','post','audio','article')), title varchar(250) NOT NULL, external_url varchar(500), media_id uuid REFERENCES media_assets(id),
  topic_id uuid REFERENCES lookup_values(id), language_code varchar(8) REFERENCES languages(code), body text,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','archived')), reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE live_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), host_user_id uuid NOT NULL REFERENCES users(id), channel_id uuid REFERENCES learning_channels(id),
  title varchar(250) NOT NULL, topic_id uuid REFERENCES lookup_values(id), scheduled_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  provider_stream_ref varchar(200), playback_url varchar(500), recording_media_id uuid REFERENCES media_assets(id), started_at timestamptz, ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE live_session_registrations (  -- gated via the session (no tenant_id)
  session_id uuid NOT NULL REFERENCES live_sessions(id), user_id uuid NOT NULL REFERENCES users(id), registered_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (session_id, user_id));

-- RLS: the tenant tables are private to their tenant (Law 1).
ALTER TABLE learning_channels  ENABLE ROW LEVEL SECURITY; ALTER TABLE learning_channels  FORCE ROW LEVEL SECURITY;
ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY; ALTER TABLE learning_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE live_sessions      ENABLE ROW LEVEL SECURITY; ALTER TABLE live_sessions      FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_lc ON learning_channels  USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_lr ON learning_resources USING (tenant_id = current_tenant_id());
CREATE POLICY t_iso_ls ON live_sessions      USING (tenant_id = current_tenant_id());
COMMIT;
