-- apps/api/test/sql/reference-slices/communication_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the notification spine (db/migrations/0012) — notification_events (GLOBAL catalog,
-- no tenant_id) + notification_templates (per event×channel×language, +tenant override) + notification_preferences
-- + user_quiet_hours (both user-scoped, no tenant_id) + notifications (PARTITIONED delivery log) — plus tenant RLS.
-- The real integration test builds its DB from the REAL db/migrations + db/seeds (incl. the 0007 catalog/templates).
--
-- Flow: a module emits a domain event → the fanout handler resolves the catalog event's channels ∩ the user's
-- prefs (mandatory events ignore opt-out; critical bypasses quiet hours) → renders the effective template
-- (tenant override → platform default) → dispatches via the external notifier gateway → records ONE delivery row
-- per channel. notification_events/templates(platform rows) are global; notifications carry tenant_id (RLS).
BEGIN;
DROP TABLE IF EXISTS notifications, user_quiet_hours, notification_preferences, notification_templates, notification_events, languages, users, tenants CASCADE;
DROP TYPE IF EXISTS notif_status CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE TYPE notif_status AS ENUM ('queued','sent','delivered','failed','read','suppressed');

CREATE TABLE tenants   (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users     (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE languages (code varchar(8) PRIMARY KEY, name_english varchar(60) NOT NULL);

CREATE TABLE notification_events (  -- GLOBAL trigger catalog (no tenant_id)
  code varchar(80) PRIMARY KEY, default_name varchar(150) NOT NULL,
  priority varchar(15) NOT NULL DEFAULT 'informational' CHECK (priority IN ('critical','important','informational','promotional')),
  default_channels jsonb NOT NULL DEFAULT '["push"]', user_can_opt_out boolean NOT NULL DEFAULT true, batchable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);

CREATE TABLE notification_templates (  -- per event×channel×language (+ tenant override); platform row = tenant_id NULL
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), event_code varchar(80) NOT NULL REFERENCES notification_events(code),
  channel varchar(15) NOT NULL, language_code varchar(8) NOT NULL REFERENCES languages(code), tenant_id uuid REFERENCES tenants(id),
  subject varchar(250), body text NOT NULL, provider_template_ref varchar(120), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
  UNIQUE (event_code, channel, language_code, tenant_id));

CREATE TABLE notification_preferences (  -- user-scoped (no tenant_id)
  user_id uuid NOT NULL REFERENCES users(id), event_code varchar(80) NOT NULL REFERENCES notification_events(code),
  channel varchar(15) NOT NULL, is_enabled boolean NOT NULL, PRIMARY KEY (user_id, event_code, channel));

CREATE TABLE user_quiet_hours (  -- user-scoped (no tenant_id)
  user_id uuid PRIMARY KEY REFERENCES users(id), starts time NOT NULL DEFAULT '21:00', ends time NOT NULL DEFAULT '06:00', timezone varchar(40) NOT NULL DEFAULT 'Asia/Kolkata');

CREATE TABLE notifications (  -- PARTITIONED delivery log by created_at; cost_minor = SMS cost-bomb monitor
  id uuid NOT NULL DEFAULT uuid_generate_v7(), tenant_id uuid, user_id uuid NOT NULL, event_code varchar(80) NOT NULL, channel varchar(15) NOT NULL,
  template_id uuid, language_code varchar(8), payload jsonb NOT NULL DEFAULT '{}', status notif_status NOT NULL DEFAULT 'queued',
  provider_msg_ref varchar(150), cost_minor integer, batched_into uuid, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, read_at timestamptz,
  PRIMARY KEY (id, created_at)) PARTITION BY RANGE (created_at);
CREATE TABLE notifications_default PARTITION OF notifications DEFAULT;
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- RLS: notifications are tenant-scoped (NULL tenant = platform-wide, visible to all). The catalog + templates'
-- platform rows are global; preferences/quiet-hours are user-scoped (filtered by user_id in the app, no RLS).
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY; ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_notif ON notifications          USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_ntpl  ON notification_templates USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
COMMIT;
