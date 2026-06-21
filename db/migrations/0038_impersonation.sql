-- ============================================================================
-- MIGRATION 0038 — IMPERSONATION (god-mode support "act-as a tenant user", Law 11)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
--
-- The HIGHEST-SENSITIVITY control: a platform support operator acts AS a specific tenant user to reproduce an
-- issue. It is built deliberately to be safe by construction: a grant is SHORT-LIVED (time-boxed), READ-ONLY in
-- scope, requires a mandatory reason, and EVERY action taken under it is recorded. The actual "act-as" token is a
-- separately-signed, short-TTL impersonation token (apps/admin-api mints it; an impersonation-aware apps/api
-- honours it — see the module README integration note). These tables are the audit/control backbone:
--
--   impersonation_grants  — one row per granted session: who (admin_user_id) acted as whom (target_user_id) in
--                           which tenant (target_tenant_id), why (reason), the scope, the lifecycle status
--                           (active→ended|expired|revoked), and the hard expiry (expires_at). The grant id is the
--                           token's jti — revoking/ending the grant invalidates the token server-side.
--   impersonation_actions — append-only log of EVERY action performed under a grant (method/path/action), beyond
--                           the audit_log row written when the grant is opened/closed. Exhaustive accountability.
--
-- Both are PLATFORM/god-mode tables: they carry target_tenant_id (NOT tenant_id), so the idempotent RLS pass skips
-- them (RLS is for tenant-scoped tables; these are operated by the RLS-bypassing kv_admin role and every action is
-- audited). The target_* FKs keep referential integrity to the impersonated tenant/user.
-- ============================================================================

CREATE TABLE impersonation_grants (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),  -- also the token jti
  admin_user_id    uuid NOT NULL,                                -- the platform operator who impersonates
  target_tenant_id uuid NOT NULL REFERENCES tenants(id),
  target_user_id   uuid NOT NULL REFERENCES users(id),
  reason           text NOT NULL,                                -- mandatory justification (audit / §4)
  scope            varchar(20) NOT NULL CHECK (scope IN ('read_only')),  -- write/full impersonation deliberately excluded
  status           varchar(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'ended', 'expired', 'revoked')),
  expires_at       timestamptz NOT NULL,                         -- hard time-box (created_at + ttl)
  ended_at         timestamptz,
  ended_by         uuid,                                         -- who ended/revoked it
  end_reason       text
);
CALL add_std_columns('impersonation_grants');
-- at most ONE active grant per (admin, target user) — no fan-out of concurrent sessions (abuse guard §4)
CREATE UNIQUE INDEX uq_imp_active_per_admin_target ON impersonation_grants(admin_user_id, target_user_id) WHERE status = 'active';
CREATE INDEX idx_imp_grants_list ON impersonation_grants(created_at DESC, id);
CREATE INDEX idx_imp_grants_target ON impersonation_grants(target_tenant_id, created_at DESC, id);
CREATE INDEX idx_imp_grants_active_exp ON impersonation_grants(expires_at) WHERE status = 'active';

CREATE TABLE impersonation_actions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  grant_id         uuid NOT NULL REFERENCES impersonation_grants(id),
  target_tenant_id uuid NOT NULL,
  method           varchar(10) NOT NULL,                         -- HTTP method (read-only ⇒ GET/HEAD expected)
  path             varchar(300) NOT NULL,                        -- request path (no query string / PII)
  action           varchar(120),                                 -- optional semantic action code
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_imp_actions_grant ON impersonation_actions(grant_id, created_at DESC, id);
