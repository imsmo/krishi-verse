-- ============================================================================
-- bloat-check.sql · Dead-tuple bloat + vacuum freshness + wraparound watch.
-- Run: weekly + when a previously-fast table slows down.
-- ALERT IF: dead_pct > 20% on a hot table, last_autovacuum is stale, or xid_age
--           approaches autovacuum_freeze_max_age (default 200M). Tuning: dba/vacuum-analyze-policy.md
-- ============================================================================

-- 1) Dead-tuple ratio + last (auto)vacuum/analyze (the everyday bloat signal).
SELECT relname AS table, n_live_tup AS live, n_dead_tup AS dead,
       CASE WHEN n_live_tup + n_dead_tup > 0
            THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1) END AS dead_pct,
       last_autovacuum, last_autoanalyze,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables WHERE n_dead_tup > 1000
ORDER BY dead_pct DESC NULLS LAST LIMIT 40;

-- 2) Tables NEVER auto-vacuumed/analyzed but actively written (stats may be stale →
--    bad plans). Investigate autovacuum settings/cost limits.
SELECT relname AS table, n_mod_since_analyze, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE (last_autovacuum IS NULL OR last_autoanalyze IS NULL) AND n_mod_since_analyze > 10000
ORDER BY n_mod_since_analyze DESC LIMIT 30;

-- 3) Autovacuum currently running (and for how long) — long runs may need more workers
--    or higher cost limits at high write volume.
SELECT pid, datname, left(query, 90) AS query, now() - xact_start AS running_for
FROM pg_stat_activity WHERE query ILIKE 'autovacuum:%' ORDER BY xact_start;

-- 4) TXID WRAPAROUND — the silent cluster-killer at high write rates.
SELECT datname, age(datfrozenxid) AS xid_age,
       round(100.0 * age(datfrozenxid) /
             (SELECT setting::bigint FROM pg_settings WHERE name='autovacuum_freeze_max_age'), 1) AS pct_to_forced_vacuum
FROM pg_database ORDER BY xid_age DESC;  -- pct_to_forced_vacuum > 50% → investigate now.

-- 5) Largest relations (where bloat costs the most storage/IO).
SELECT relid::regclass AS object, pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;
-- For exact bloat figures, install pgstattuple and: SELECT * FROM pgstattuple('orders');
