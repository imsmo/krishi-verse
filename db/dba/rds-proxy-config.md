# Connection Pooling (RDS Proxy / pgBouncer)

The app must NOT open raw connections to Postgres at scale — thousands of API/worker
pods would exhaust `max_connections`. A pooler multiplexes many client connections
onto few database connections.

## CRITICAL: pooling mode vs our RLS pattern
Our `PgUnitOfWork` sets tenant context **per transaction** with
`SELECT set_config('app.tenant_id', $1, true)` — the `true` makes it **LOCAL** (scoped
to the transaction, auto-reset at COMMIT/ROLLBACK). This is exactly what makes
**transaction-level pooling safe**:

- ✅ **Transaction pooling** (pgBouncer `pool_mode = transaction`, RDS Proxy default):
  safe. Each transaction carries and resets its own `app.tenant_id`/`app.user_id`. A
  reused backend never leaks the previous tenant's context.
- ⚠️ **Session pooling**: works but far fewer effective connections; only if you must.
- ❌ **NEVER** set tenant context with a **non-LOCAL** `SET` (session GUC) under
  transaction pooling — it would leak across requests sharing a backend = a
  cross-tenant data breach. (Our code already uses LOCAL; enforce in review.)
- Prepared-statement pinning: ensure the driver/proxy handles protocol-level prepared
  statements (RDS Proxy pins on some; `node-postgres` simple/extended is fine).

## Recommended setup
- **RDS Proxy** in front of the Aurora writer (and a second proxy for the reader
  endpoint used by CQRS reads).
- App pool (`DATABASE_POOL_MAX`) small per pod (e.g. 10–20); the proxy fans many pods
  into a bounded DB connection count.
- Separate proxies/users for: app (`kv_app`, least privilege), migrations (owner),
  analytics/read-replica.
- IAM auth on the proxy where possible; TLS required.

## Monitor
- `dba/connection-audit.sql` (#1 pct_used < 80%, #3 no idle-in-transaction leaks).
- RDS Proxy CloudWatch: `DatabaseConnections`, `ClientConnections`, borrow latency,
  pinning count (high pinning defeats pooling — investigate).
