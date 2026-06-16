# Failover Runbook (Primary database)

**Targets:** RTO ≤ 60s (Aurora automatic failover), RPO ≈ 0 (synchronous standby).
**Severity:** Sev-1. Page the on-call DBA + incident commander.

## Detect
- CloudWatch alarm: writer unreachable / `readyz` failing on the API
  (`/readyz` runs `SELECT 1` on the writer pool).
- Symptoms: writes 5xx, reads may still work (replicas).

## Automatic path (Aurora, expected)
1. Aurora promotes a standby to writer automatically; the cluster **writer endpoint**
   now points to the new primary.
2. The app must reconnect: connection pools/RDS Proxy drop stale connections; our pools
   reconnect on error. Confirm `/readyz` recovers within ~60–90s.
3. Verify writes succeed (place a test order in a canary tenant).

## Manual path (if automatic failover stalls)
1. `aws rds failover-db-cluster --db-cluster-identifier krishi-prod` (promotes a reader).
2. Or promote a specific replica: `aws rds failover-db-cluster ... --target-db-instance-identifier <reader>`.
3. Wait for `available`; confirm the writer endpoint resolves to the new instance.

## After failover — verify in order
1. `/readyz` green on all API pods; error rate back to baseline.
2. `dba/replication-lag.sql` — remaining replicas re-attached and catching up.
3. **Money integrity:** run the zero-sum reconciliation (`reconciliation_runs`,
   `run_type='zero_sum_check'`) — ledger must still balance; investigate any mismatch
   before re-enabling payouts.
4. `dba/connection-audit.sql` — no connection storm; pools healthy.
5. Check the transactional **outbox** drained (no stuck `outbox_events` with
   `status='pending'` older than a few minutes) — relay reconnected.

## Comms
- Post to status page (`ops/statuspage.md`), update the incident channel every 15 min,
  write the postmortem (blameless) within 48h.

## Guardrails
- Never point the app at a reader endpoint for writes.
- Do not truncate/replay the outbox manually — it is idempotent and will resume.
