-- db/dba/replication-lag.sql · Replica health. Run continuously (alert source).
-- CQRS read paths run on replicas; if a replica lags, users see stale data and the
-- read fleet effectively shrinks. Watch both byte lag and time lag.

-- 1) On the PRIMARY: per-replica send/replay lag.
SELECT client_addr, application_name, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn))   AS sent_lag,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag,
       write_lag, flush_lag, replay_lag AS replay_time_lag
FROM pg_stat_replication
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) DESC;

-- 2) Replication slots (a stale/inactive slot retains WAL forever → disk fills).
SELECT slot_name, slot_type, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots ORDER BY retained_wal DESC;

-- 3) On a REPLICA: how far behind in seconds (run on the standby).
SELECT CASE WHEN pg_is_in_recovery()
            THEN extract(epoch FROM (now() - pg_last_xact_replay_timestamp()))
            ELSE 0 END AS replica_lag_seconds;
-- ACTION: replica_lag_seconds > 5 sustained → investigate (long txns on primary,
--         under-provisioned replica, network). Route critical reads to primary meanwhile.

-- 4) WAL generation rate proxy (high churn → replicas/slots must keep up).
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')) AS wal_position;

-- 5) ALERT THRESHOLDS: replay byte-lag > 256MB sustained, OR replica_lag_seconds > 5,
--    OR any inactive replication slot retaining > 1GB WAL → page; route critical reads
--    to the primary until the replica recovers.
