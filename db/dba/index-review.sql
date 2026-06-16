-- ============================================================================
-- index-review.sql · Index hygiene. Run: monthly.
-- Every index is paid for on EVERY insert/update — at billions of writes, an unused
-- or duplicate index is pure tax. Missing indexes on hot filters cause seq scans.
-- ALERT IF: unused index > 100MB, any invalid index, FK without a covering index.
-- ============================================================================

-- 1) UNUSED indexes (never scanned). Confirm not needed for a constraint before dropping.
SELECT s.relname AS table, s.indexrelname AS index,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size, s.idx_scan AS scans
FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid=s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 50;

-- 2) DUPLICATE indexes (identical column set on a table) — drop the redundant one.
SELECT indrelid::regclass AS table, array_agg(indexrelid::regclass) AS duplicate_indexes
FROM pg_index GROUP BY indrelid, indkey HAVING count(*) > 1;

-- 3) INVALID indexes (failed CREATE INDEX CONCURRENTLY) — silently unused; rebuild.
SELECT indexrelid::regclass AS index, indrelid::regclass AS table
FROM pg_index WHERE NOT indisvalid;

-- 4) FOREIGN KEYS WITHOUT A COVERING INDEX — causes slow joins + lock escalation on
--    parent updates/deletes. High-value to fix on a multi-tenant, highly-related schema.
SELECT c.conrelid::regclass AS table, a.attname AS fk_column, c.conname AS constraint
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey[0:0]))  -- leading col
ORDER BY 1, 2;

-- 5) SEQ-SCAN-HEAVY tables → candidate for a new index (check the WHERE patterns).
SELECT relname AS table, seq_scan, idx_scan, seq_tup_read,
       CASE WHEN seq_scan>0 THEN round(seq_tup_read::numeric/seq_scan,0) END AS avg_rows_per_seqscan
FROM pg_stat_user_tables
WHERE seq_scan > 1000 AND (idx_scan IS NULL OR seq_scan > idx_scan)
ORDER BY seq_tup_read DESC LIMIT 30;

-- 6) LOW-USAGE large indexes (scanned rarely, but big) — review cost/benefit.
SELECT s.relname AS table, s.indexrelname AS index, s.idx_scan AS scans,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid=s.indexrelid
WHERE NOT i.indisprimary AND NOT i.indisunique
  AND s.idx_scan BETWEEN 1 AND 50 AND pg_relation_size(s.indexrelid) > 50*1024*1024
ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 30;
