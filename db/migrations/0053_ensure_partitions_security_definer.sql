-- ============================================================================
-- MIGRATION 0053 — ensure_partitions() runs as DEFINER (owner), not caller
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY: the worker (apps/worker, connecting as kv_relay) calls `CALL ensure_partitions()` hourly to pre-create
-- future partitions. Creating/attaching partitions is DDL that requires ownership of the parent partitioned
-- tables + CREATE on schema public — privileges kv_relay (a BYPASSRLS *data* role) deliberately does not hold.
-- As a SECURITY INVOKER procedure this failed with "permission denied for schema public".
--
-- FIX: mark the maintenance procedure SECURITY DEFINER so it executes with the privileges of its OWNER (the
-- migration/admin role that owns the partitioned tables), regardless of which app role CALLs it. This mirrors the
-- pattern already used for trace_scan() (migration 0028). A fixed search_path prevents object-resolution hijacking
-- (a SECURITY DEFINER best practice). EXECUTE remains available to the app roles (PUBLIC default).
-- ============================================================================

ALTER PROCEDURE ensure_partitions(integer) SECURITY DEFINER;
ALTER PROCEDURE ensure_partitions(integer) SET search_path = public, pg_temp;
