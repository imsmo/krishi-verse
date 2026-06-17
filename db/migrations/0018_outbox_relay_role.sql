-- ============================================================================
-- MIGRATION 0018 — OUTBOX RELAY ROLE (cross-module event delivery)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- The transactional outbox relay (core/outbox dispatcher) is a TRUSTED SYSTEM process: it must
-- read PENDING events across ALL tenants and run the consuming handlers. kv_app is tenant-scoped
-- by RLS (correct for the request tier) and therefore cannot claim other tenants' events.
-- kv_relay is a dedicated, login-less role that BYPASSes RLS for this system job and still records
-- tenant context per event (the relay sets app.tenant_id before invoking handlers). Ops grant it a
-- password/login out-of-band and run ONLY the worker's relay as this role — never the request API.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kv_relay') THEN
    CREATE ROLE kv_relay NOLOGIN BYPASSRLS;
  ELSE
    ALTER ROLE kv_relay BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO kv_relay;
-- The relay reads events and runs handlers that confirm orders, settle escrow, etc. — it needs the
-- same table DML as the app, plus it bypasses RLS (above) to see every tenant's pending events.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kv_relay;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kv_relay;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kv_relay;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kv_relay;
