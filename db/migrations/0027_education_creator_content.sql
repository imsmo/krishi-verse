-- ============================================================================
-- MIGRATION 0027 — EDUCATION CREATOR CONTENT (M09 extension, PRD §9.9)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- Adds the creator/community-learning layer on top of courses/enrollments: external content channels
-- (YouTube / other platforms / blogs), curated resources, and live streaming sessions — with self-service
-- hosting GATED BY tenant-admin approval. All tenant tables get tenant_id + the standard columns; RLS is
-- applied by re-running the idempotent 0014/0020 pass at the foot of this file.
-- ============================================================================

-- 1. learning_channels — a creator's external content channel; admin-approved before it can publish/stream.
CREATE TABLE learning_channels (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  provider      varchar(20) NOT NULL,                 -- youtube|vimeo|website|podcast|other
  title         varchar(200) NOT NULL,
  handle        varchar(120),                         -- @channel / username
  external_url  varchar(500) NOT NULL,
  topic_id      uuid REFERENCES lookup_values(id),    -- 'course_topic'
  description   text,
  status        varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  review_note   text,
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  UNIQUE (tenant_id, provider, external_url)
);
CALL add_std_columns('learning_channels');
CREATE INDEX idx_learning_channels_owner ON learning_channels(tenant_id, owner_user_id, created_at DESC);
CREATE INDEX idx_learning_channels_pub ON learning_channels(tenant_id, topic_id) WHERE status='approved';

-- 2. learning_resources — individual curated items (external video/blog/post/audio) under a channel or standalone.
CREATE TABLE learning_resources (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  channel_id    uuid REFERENCES learning_channels(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  kind          varchar(20) NOT NULL CHECK (kind IN ('video','blog','post','audio','article')),
  title         varchar(250) NOT NULL,
  external_url  varchar(500),
  media_id      uuid REFERENCES media_assets(id),
  topic_id      uuid REFERENCES lookup_values(id),
  language_code varchar(8) REFERENCES languages(code),
  body          text,
  status        varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','archived')),
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz
);
CALL add_std_columns('learning_resources');
CREATE INDEX idx_learning_resources_browse ON learning_resources(tenant_id, topic_id, created_at DESC) WHERE status='approved';
CREATE INDEX idx_learning_resources_channel ON learning_resources(channel_id, created_at DESC);

-- 3. live_sessions — a streaming session hosted by an approved channel owner.
CREATE TABLE live_sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  host_user_id  uuid NOT NULL REFERENCES users(id),
  channel_id    uuid REFERENCES learning_channels(id),
  title         varchar(250) NOT NULL,
  topic_id      uuid REFERENCES lookup_values(id),
  scheduled_at  timestamptz NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  provider_stream_ref varchar(200),                   -- streaming provider's stream id
  playback_url  varchar(500),
  recording_media_id uuid REFERENCES media_assets(id),
  started_at    timestamptz,
  ended_at      timestamptz
);
CALL add_std_columns('live_sessions');
CREATE INDEX idx_live_sessions_upcoming ON live_sessions(tenant_id, scheduled_at) WHERE status IN ('scheduled','live');
CREATE INDEX idx_live_sessions_host ON live_sessions(tenant_id, host_user_id, created_at DESC);

-- 4. live_session_registrations — attendees (no tenant_id; gated through the session join).
CREATE TABLE live_session_registrations (
  session_id    uuid NOT NULL REFERENCES live_sessions(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- 5. RLS — re-run the idempotent tenant-isolation pass (0014/0020). It protects ONLY the newly-added tenant
--    tables (skips any table that already has a policy + the wallet/ledger tables). learning_session_registrations
--    has no tenant_id and is isolated through its live_sessions FK.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='tenant_id'
    WHERE t.schemaname='public'
      AND t.tablename NOT IN ('wallet_accounts','ledger_entries','ledger_transactions','reconciliation_runs')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.tablename)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format($f$CREATE POLICY tenant_isolation_%s ON %I
                     USING (tenant_id IS NULL OR tenant_id = current_tenant_id());$f$,
                   r.tablename, r.tablename);
  END LOOP;
END $$;
