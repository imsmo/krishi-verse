-- apps/api/test/sql/01_app_role.sql
-- Give the least-privilege application role LOGIN so the integration tests can connect as it.
-- Migration 0014 already CREATEs kv_app (NOLOGIN) and grants its production privileges
-- (SELECT/INSERT/UPDATE + the targeted DELETE grants in 0016); in production, ops grant the
-- login/password out-of-band. We deliberately do NOT re-grant table privileges here, so the
-- test's kv_app has EXACTLY the production privilege set — any missing grant surfaces as a
-- failing integration test instead of being papered over.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kv_app') THEN
    CREATE ROLE kv_app LOGIN PASSWORD 'kv_app_pw';
  ELSE
    ALTER ROLE kv_app WITH LOGIN PASSWORD 'kv_app_pw';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO kv_app;
