-- ============================================================================
-- MIGRATION 0040 — ANNOUNCEMENTS (god-mode platform-wide banners/notices, Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- PLATFORM-WIDE announcements (maintenance windows, incident notices, product news) shown across tenant panels /
-- apps. Distinct from cms `banners` (0012, tenant-scoped marketing). Authored ONLY in apps/admin-api (Law 11); the
-- apps/api read path surfaces the currently-live ones (status='published' AND now within the starts_at..ends_at AND
-- audience matches) — see the module README integration note.
--
--   platform_announcements — the notice: title/body (PLAIN TEXT — no HTML, sanitised in the DTO), severity,
--                            placement, a draft→scheduled→published→expired/archived lifecycle, an optional
--                            schedule window, and an audience targeting blob ({plans:[],countries:[]}; empty = all).
--   announcement_changes   — append-only history (created/updated/scheduled/published/expired/archived) with
--                            old→new + reason + actor (audit_log also records each change in-tx).
--
-- Both are PLATFORM/god-mode (no tenant_id) ⇒ the idempotent RLS pass skips them; operated only by the RLS-
-- bypassing kv_admin role, every action audited.
-- ============================================================================

CREATE TABLE platform_announcements (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  title       varchar(200) NOT NULL,
  body        text NOT NULL,
  severity    varchar(10) NOT NULL DEFAULT 'info'  CHECK (severity IN ('info', 'warning', 'critical')),
  placement   varchar(10) NOT NULL DEFAULT 'banner' CHECK (placement IN ('banner', 'modal', 'toast')),
  status      varchar(12) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'scheduled', 'published', 'expired', 'archived')),
  audience    jsonb NOT NULL DEFAULT '{}',          -- {plans:[],countries:[]}; empty = everyone
  starts_at   timestamptz,
  ends_at     timestamptz,
  published_at timestamptz
);
CALL add_std_columns('platform_announcements');
CREATE INDEX idx_announcements_list ON platform_announcements(created_at DESC, id);
-- hot read for the live-banner query: published + within window
CREATE INDEX idx_announcements_live ON platform_announcements(starts_at, ends_at) WHERE status = 'published';

CREATE TABLE announcement_changes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  announcement_id uuid NOT NULL REFERENCES platform_announcements(id),
  action          varchar(20) NOT NULL
                    CHECK (action IN ('created', 'updated', 'scheduled', 'published', 'expired', 'archived')),
  old_value       jsonb,
  new_value       jsonb,
  reason          text NOT NULL,
  actor_user_id   uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcement_changes ON announcement_changes(announcement_id, created_at DESC, id);
