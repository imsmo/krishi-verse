-- db/dba/locks-monitor.sql · Who is blocking whom, right now.
-- First stop during "the app is slow / writes are hanging". Shows the blocking
-- tree so you can identify (and, if needed, terminate) the head-of-line blocker.

-- 1) Blocked → blocking pairs with the SQL of each.
SELECT blocked.pid                AS blocked_pid,
       blocked.usename            AS blocked_user,
       left(blocked.query, 80)    AS blocked_query,
       blocked.wait_event_type,
       blocking.pid               AS blocking_pid,
       blocking.usename           AS blocking_user,
       left(blocking.query, 80)   AS blocking_query,
       now() - blocked.query_start AS blocked_for
FROM pg_stat_activity blocked
JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS bpid(pid) ON true
JOIN pg_stat_activity blocking ON blocking.pid = bpid.pid
WHERE blocked.wait_event_type = 'Lock'
ORDER BY blocked_for DESC;

-- 2) Longest-held locks overall (not just blockers).
SELECT a.pid, a.usename, a.state, a.wait_event_type, a.wait_event,
       now() - a.xact_start AS txn_age, left(a.query, 100) AS query
FROM pg_stat_activity a
WHERE a.state <> 'idle'
ORDER BY a.xact_start NULLS LAST
LIMIT 25;

-- 3) Emergency: terminate a specific blocker (UNCOMMENT, set the pid).
-- SELECT pg_terminate_backend(<blocking_pid>);
