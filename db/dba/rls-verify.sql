-- db/dba/rls-verify.sql · Tenant-isolation safety audit. Run nightly + in CI.
-- The platform's #1 invariant: no tenant can ever see another tenant's rows.
-- This is enforced by RLS in the database (defense-in-depth on top of the app's
-- tenant_id filters). These checks must all come back clean.

-- 1) The merge-gate view: any tenant-scoped table missing an RLS policy.
--    MUST return zero rows. (Money tables are intentionally excluded — they are
--    locked down by role grants, not RLS.)
SELECT 'tables_without_rls' AS check, tablename FROM v_tables_without_rls ORDER BY tablename;

-- 2) Tenant tables where RLS is enabled but NOT forced (table owner could bypass).
--    MUST return zero rows.
SELECT 'rls_not_forced' AS check, c.relname AS tablename
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN information_schema.columns col
  ON col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id'
WHERE c.relkind IN ('r','p') AND c.relrowsecurity AND NOT c.relforcerowsecurity
ORDER BY 1;

-- 3) Inventory: every policy in place (review after each migration).
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- 4) Sanity: confirm the tenant resolver exists and behaves (NULL outside a request).
SELECT 'current_tenant_id_when_unset' AS check, current_tenant_id() AS value;  -- expect NULL
