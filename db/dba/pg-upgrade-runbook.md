# PostgreSQL Major Version Upgrade Runbook

Zero-/low-downtime major upgrades using **blue/green** (Aurora Blue/Green Deployments
or a logical-replication cutover). Never `pg_upgrade` in place on production.

## Pre-flight (staging first, always)
1. Restore the latest prod snapshot into staging; run the full migration set
   (`pnpm migrate`) and the app test suites against the target version.
2. **Extension compatibility:** confirm `pgcrypto`, `pg_trgm`, `btree_gist`, `ltree`,
   `pg_stat_statements` exist on the target version.
3. **Feature checks for our schema:**
   - RLS policies + `FORCE ROW LEVEL SECURITY` still enforced (`dba/rls-verify.sql`).
   - Partitioning + `ensure_partitions()` still works (`node db/scripts/ensure-partitions.js`).
   - `uuid_generate_v7()` and helpers compile.
4. Capture baseline query plans for the top 25 (`dba/slow-queries-weekly.sql`) — major
   versions can change the planner; compare after.

## Cutover (blue/green)
1. Create the green environment on the new version; it stays in sync via replication.
2. Freeze migrations during the window (no schema changes).
3. Verify replication lag ≈ 0 (`dba/replication-lag.sql`).
4. Switch the writer endpoint to green (Aurora handles this); app reconnects.
5. Smoke test: canary order + payout reconciliation + a read on a replica.

## After
1. `ANALYZE` the whole database (fresh planner stats on the new version).
2. Compare top query plans vs baseline; fix regressions (add indexes / hints).
3. Keep blue for 24–48h as instant rollback, then decommission.

## Rollback
If green misbehaves before DNS/endpoint propagation completes, switch back to blue
(still primary until cutover is confirmed). After cutover, roll back only via the
retained blue environment.
