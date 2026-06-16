-- db/dba/connection-audit.sql · Connection pressure + leak detection.
-- At scale, connection exhaustion is a top outage cause. The app must sit behind
-- a transaction-pooling proxy (see dba/rds-proxy-config.md); these queries tell
-- you if pools are saturated or leaking idle-in-transaction connections.

-- 1) Usage vs cap.
SELECT (SELECT count(*) FROM pg_stat_activity)                          AS total,
       (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_connections,
       round(100.0 * (SELECT count(*) FROM pg_stat_activity)
             / (SELECT setting::int FROM pg_settings WHERE name='max_connections'), 1) AS pct_used;

-- 2) Breakdown by state, user, application, and source.
SELECT state, usename, application_name, client_addr, count(*) AS conns,
       max(now() - state_change) AS oldest_in_state
FROM pg_stat_activity
GROUP BY state, usename, application_name, client_addr
ORDER BY conns DESC;

-- 3) Leaks: idle-in-transaction longer than 1 minute (holds locks + bloats).
SELECT pid, usename, application_name, now() - state_change AS idle_for, left(query, 80) AS last_query
FROM pg_stat_activity
WHERE state = 'idle in transaction' AND now() - state_change > interval '1 minute'
ORDER BY idle_for DESC;

-- 4) Backends currently WAITING on a lock (contention right now).
SELECT count(*) AS waiting_on_locks FROM pg_stat_activity WHERE wait_event_type='Lock';

-- 5) Longest-running active statements (cancel candidates if runaway).
SELECT pid, usename, now()-query_start AS running_for, left(query,90) AS query
FROM pg_stat_activity WHERE state='active' AND now()-query_start > interval '30 seconds'
ORDER BY running_for DESC LIMIT 20;
