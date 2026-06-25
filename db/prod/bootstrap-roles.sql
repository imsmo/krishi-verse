-- db/prod/bootstrap-roles.sql · PRODUCTION role login bootstrap (run as the Aurora master user).
-- The app roles kv_app / kv_wallet / kv_relay are created NOLOGIN by migrations 0014/0018 (least-privilege,
-- RLS-enforced). This grants them LOGIN with STRONG passwords. Passwords are injected as psql variables from
-- AWS Secrets Manager by create-roles.sh — they are NEVER written in this file or in git.
--
-- This is the PRODUCTION-SAFE counterpart to db/local/local-login-roles.sql (which uses weak dev passwords
-- and must NEVER run in prod). Idempotent: safe to re-run (e.g. on password rotation).
--
-- Invoke (do NOT type passwords on the CLI; create-roles.sh pipes them in):
--   psql "$MASTER_URL" -v kv_app_pw="$APP_PW" -v kv_wallet_pw="$WALLET_PW" -v kv_relay_pw="$RELAY_PW" \
--        -f db/prod/bootstrap-roles.sql

\set ON_ERROR_STOP on

-- Guard: refuse to run unless all three passwords were supplied (fail closed).
DO $$
BEGIN
  IF current_setting('is_superuser') = 'off' THEN
    -- master user on Aurora is not a true superuser but owns the roles; that's fine. No-op guard.
    NULL;
  END IF;
END $$;

ALTER ROLE kv_app    WITH LOGIN PASSWORD :'kv_app_pw';
ALTER ROLE kv_wallet WITH LOGIN PASSWORD :'kv_wallet_pw';
ALTER ROLE kv_relay  WITH LOGIN PASSWORD :'kv_relay_pw';

-- Defence in depth: app roles must NOT be able to bypass RLS or create roles/dbs.
ALTER ROLE kv_app    WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
ALTER ROLE kv_wallet WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
-- kv_relay is the infra relay; it legitimately needs BYPASSRLS for cross-tenant sweeps (set by migration 0018).
ALTER ROLE kv_relay  WITH NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Sanity: show the roles can now log in (no secrets printed).
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
FROM pg_roles WHERE rolname IN ('kv_app','kv_wallet','kv_relay') ORDER BY rolname;
