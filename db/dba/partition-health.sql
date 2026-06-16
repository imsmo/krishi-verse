-- ============================================================================
-- partition-health.sql · Are all hot tables partitioned ahead of time, sized OK,
-- and pruning correctly? Run: daily (alerting) + during any write-latency incident.
-- ALERT IF: any parent has < 2 months runway, OR a _default partition has rows,
--           OR a single partition exceeds the size budget.
-- Fix runway: `node db/scripts/ensure-partitions.js`.  Retire cold: archive-partitions.js
-- ============================================================================

-- 1) RUNWAY — months of future partitions per partitioned parent. <2 = page.
WITH parts AS (
  SELECT i.inhparent::regclass::text AS parent, c.relname AS child,
         pg_get_expr(c.relpartbound, c.oid) AS bound
  FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
), parsed AS (
  SELECT parent, child,
         NULLIF(substring(bound from 'TO \(''(\d{4}-\d{2}-\d{2})'''), '')::date AS upper_to,
         bound ILIKE '%DEFAULT%' AS is_default
  FROM parts
)
SELECT parent,
       count(*) FILTER (WHERE NOT is_default)      AS month_partitions,
       bool_or(is_default)                          AS has_default,
       max(upper_to)                                AS newest_upper_bound,
       (date_part('year',  age(max(upper_to), date_trunc('month', now()))) * 12
        + date_part('month', age(max(upper_to), date_trunc('month', now()))))::int AS months_runway
FROM parsed GROUP BY parent
ORDER BY months_runway NULLS FIRST, parent;

-- 2) DEFAULT LEAKAGE — rows that fell into a _default partition mean a target
--    partition was missing when they were written. Should be ZERO everywhere.
--    (Dynamic across all partitioned parents.)
SELECT format('SELECT %L AS default_partition, count(*) AS rows FROM %I',
              c.relname, c.relname) AS run_this_query
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
WHERE c.relname LIKE '%\_default' AND c.relkind='r'
ORDER BY 1;  -- copy/run each; any non-zero count is an incident.

-- 3) SIZE BUDGET — biggest partitions (rebalance/shorten window if one dominates).
SELECT c.relname AS partition, i.inhparent::regclass::text AS parent,
       to_char(c.reltuples, 'FM999,999,999,999') AS est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 40;

-- 4) PRUNING SANITY — confirm a tenant+time query touches ONE partition, not all.
--    (Run EXPLAIN manually for a hot table; expect a single "..._YYYY_MM" scan.)
-- EXPLAIN SELECT * FROM orders
--   WHERE id = '<uuid>' AND created_at >= uuid_v7_time('<uuid>') - interval '1 second'
--                        AND created_at <  uuid_v7_time('<uuid>') + interval '1 second';

-- 5) PARTITION COUNT GUARD — too many partitions hurts planning time.
SELECT i.inhparent::regclass::text AS parent, count(*) AS partitions
FROM pg_inherits i GROUP BY 1 HAVING count(*) > 180 ORDER BY 2 DESC;  -- review pruning/archival
