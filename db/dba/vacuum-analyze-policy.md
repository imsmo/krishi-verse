# Vacuum / Analyze Policy

Autovacuum keeps tables from bloating and prevents transaction-ID wraparound. At our
write volume the defaults are too lax for hot tables; tune per-table.

## Principles
- **Hot OLTP tables** (`orders`, `order_items`, `payments`, `bids`, `milk_collections`):
  make autovacuum trigger sooner and run faster.
- **Append-only tables** (`ledger_entries`, `*_events`, `audit_log`, `outbox_events`,
  `notifications`): almost no dead tuples from UPDATE/DELETE, but they still need
  **aggressive freezing** to avoid wraparound. Tune `autovacuum_freeze_max_age`.
- **Partitioned tables**: autovacuum operates per child partition. Old, now-static
  partitions should be `VACUUM (FREEZE)`-ed once, then they stay quiet.

## Recommended per-table overrides
```sql
-- Hot, high-churn tables: vacuum at ~2% dead tuples instead of the 20% default.
ALTER TABLE orders        SET (autovacuum_vacuum_scale_factor = 0.02,
                               autovacuum_vacuum_cost_limit = 2000,
                               fillfactor = 90);
ALTER TABLE payments      SET (autovacuum_vacuum_scale_factor = 0.02, fillfactor = 90);
ALTER TABLE bids          SET (autovacuum_vacuum_scale_factor = 0.02);

-- Append-only: analyze often (planner stats), freeze aggressively.
ALTER TABLE ledger_entries SET (autovacuum_analyze_scale_factor = 0.01,
                                autovacuum_freeze_max_age = 100000000);
ALTER TABLE audit_log      SET (autovacuum_freeze_max_age = 100000000);
```

## Schedule
- Autovacuum **always on** (never disable).
- Weekly: review `dba/bloat-check.sql`; if `dead_pct > 20%` on a hot table, run a
  manual `VACUUM (ANALYZE)` off-peak, or `pg_repack` for online bloat removal (no
  exclusive lock).
- Monthly: `VACUUM (FREEZE)` newly-cold partitions before they're archived.
- Alert on `dba/bloat-check.sql` query #3 (xid_age) approaching 200M.

## Aurora note
Aurora PostgreSQL manages vacuum similarly; the per-table `ALTER TABLE ... SET`
storage params still apply. Monitor `VacuumMaxRunTime` and `MaximumUsedTransactionIDs`
in CloudWatch.
