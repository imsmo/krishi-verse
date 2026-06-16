-- ============================================================================
-- slow-queries-weekly.sql · Weekly perf review via pg_stat_statements.
-- Pair with: node db/scripts/explain-top-queries.js  (and --explain "<sql>").
-- ALERT IF: cache_hit_pct < 99%, any query spilling temp files, a hot query's mean
--           time regresses week-over-week. Reset window after acting (#6).
-- Requires: pg_stat_statements (cluster-level; see pg-upgrade/rds-proxy notes).
-- ============================================================================

-- 1) Heaviest by TOTAL time — where the database actually spends its life.
SELECT calls, round(total_exec_time::numeric,0) AS total_ms,
       round(mean_exec_time::numeric,2) AS mean_ms, round(stddev_exec_time::numeric,2) AS stddev_ms,
       rows, round(100.0*shared_blks_hit/nullif(shared_blks_hit+shared_blks_read,0),1) AS cache_pct,
       left(regexp_replace(query,'\s+',' ','g'),120) AS query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 25;

-- 2) Slowest by MEAN time (latency outliers; index/rewrite candidates).
SELECT calls, round(mean_exec_time::numeric,2) AS mean_ms,
       left(regexp_replace(query,'\s+',' ','g'),120) AS query
FROM pg_stat_statements WHERE calls > 50 ORDER BY mean_exec_time DESC LIMIT 25;

-- 3) TEMP-FILE spillers (work_mem too low or bad plans) — slow + IO-heavy.
SELECT calls, round(mean_exec_time::numeric,2) AS mean_ms,
       pg_size_pretty(temp_blks_written * 8192) AS temp_written,
       left(regexp_replace(query,'\s+',' ','g'),100) AS query
FROM pg_stat_statements WHERE temp_blks_written > 0
ORDER BY temp_blks_written DESC LIMIT 20;

-- 4) MOST FREQUENT (tiny but called millions of times → cache/batch candidates).
SELECT calls, round(mean_exec_time::numeric,3) AS mean_ms,
       left(regexp_replace(query,'\s+',' ','g'),100) AS query
FROM pg_stat_statements ORDER BY calls DESC LIMIT 20;

-- 5) Overall buffer cache hit ratio (OLTP target > 99%).
SELECT round(100.0*sum(shared_blks_hit)/nullif(sum(shared_blks_hit)+sum(shared_blks_read),0),2) AS cache_hit_pct
FROM pg_stat_statements;

-- 6) After acting on findings, reset the measurement window:
-- SELECT pg_stat_statements_reset();
