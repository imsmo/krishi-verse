-- apps/api/test/sql/01_app_role.sql
-- Creates the least-privilege application role. The API NEVER connects as a
-- superuser (superusers bypass RLS) — it connects as kv_app, which is subject to
-- the tenant_isolation policies. Run by CI/admin AFTER 00_listings_slice.sql.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kv_app') THEN
    CREATE ROLE kv_app LOGIN PASSWORD 'kv_app_pw';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO kv_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kv_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kv_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kv_app;
