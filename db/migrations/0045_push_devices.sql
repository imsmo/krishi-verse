-- ============================================================================
-- MIGRATION 0045 — PUSH DEVICE REGISTRY (server-targetable push tokens, API-W3)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- The communication module already SENDS push (the notification gateway), but had no place to record
-- WHICH device to send to. This table is that registry: a row per (user, push token). The mobile app
-- POSTs its Expo/FCM token after login; the server stores it so order/auction/wage notifications can
-- target the device, and DELETEs (deactivates) it on logout.
--
-- USER-SCOPED, NOT tenant-scoped — exactly like notification_preferences / user_quiet_hours (0012): a
-- device belongs to a USER (users are platform-global, used across tenants), so there is no tenant_id
-- and no RLS policy. The repository ALWAYS filters by user_id (the caller's own id from the token) — a
-- user can only ever read/write/revoke their OWN devices (no IDOR, enforced in code, mirroring the
-- engagement-table pattern). The token is treated as sensitive: it is never returned to other users and
-- never logged.
--
-- token is UNIQUE: a device's push token is globally unique, so re-registering the same token (reinstall
-- / re-login, possibly under a different account) UPSERTs — it re-points the token at its latest owner
-- and re-activates it. That keeps the registry deduped and prevents push to a token a user has handed off.
-- ============================================================================

CREATE TABLE push_devices (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  platform     varchar(15) NOT NULL CHECK (platform IN ('ios','android','web')),
  token        varchar(512) NOT NULL,                       -- Expo/FCM push token (opaque; sensitive, never logged)
  is_active    boolean NOT NULL DEFAULT true,               -- false = revoked on logout / replaced
  last_seen_at timestamptz NOT NULL DEFAULT now(),          -- bumped on every (re)register — prune stale tokens later
  UNIQUE (token)
);
CALL add_std_columns('push_devices');

-- The send-side fan-out targets a user's ACTIVE tokens; the partial index keeps that scan cheap at scale.
CREATE INDEX idx_push_devices_user_active ON push_devices (user_id) WHERE is_active;
