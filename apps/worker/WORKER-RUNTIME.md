# Worker runtime (P0-9)

The scheduled-jobs host. A standalone Node process (pg + http, no framework — same style as `wallet-service`) that
connects as **`kv_relay`** (BYPASSRLS, for cross-tenant sweeps), exposes `/metrics` + `/healthz`, and runs a
scheduler loop: every tick, each **due** job runs under its **Postgres advisory leader-lock** (so N replicas are
safe — no double purge / double recon), timed + metered, with failures isolated.

## What it runs (operational, pg-native, bounded + idempotent)
| Job | Cadence | Does | Emits (for P0-6 alerts) |
|-----|---------|------|--------------------------|
| `recon-zero-sum` | 5 min | ledger Σlegs≠0 monitor → reconciliation_runs row | `kv_recon_mismatches`, `kv_recon_age_seconds` |
| `ensure-partitions` | hourly | `CALL ensure_partitions()` | `kv_partition_days_ahead` |
| `retention-enforcer` | daily | purge `delete`-action policies past `active_months` (catalog-validated table + created_at) | `kv_retention_purged_total` |
| `idempotency-purge` | hourly | drop expired `idempotency_keys` (bounded) | `kv_idempotency_purged_total` |
| `dpdp-erasure-cooling` | hourly | advance erasure DSRs past 90-day cooling → `identity.erasure_ready` outbox | `kv_erasure_advanced_total` |
| `outbox-gauge` | 1 min | measure unrelayed outbox backlog | `kv_outbox_pending` |

Every job is timed into `worker_job{job,ok}` + failures into `worker_job_failures{job}`.

## Design
- `config.ts` — fail-closed (prod requires a non-localhost, strong-password, **kv_relay** TLS DB URL).
- `runtime/cron.ts` + `runtime/leader-lock.ts` + `runtime/runner.ts` — **pure** (clock + effects injected),
  unit-tested (`__tests__/scheduler.spec.ts`: due-logic, lock-key determinism, run/skip/lock-miss/failure-isolation).
- `runtime/leader-lock.ts` uses `pg_try_advisory_lock(key)` on a dedicated connection held for the job's duration.
- `metrics.ts` — Prometheus exposition with **valid names** (mirrors the api's sanitiser) served at `/metrics`.

## Run
```bash
NODE_ENV=production DATABASE_URL='postgresql://kv_relay:***@<aurora>:5432/krishiverse?sslmode=require' \
METRICS_PORT=9090 node apps/worker/dist/main.js
```
Deployed via the `worker` Helm chart (no Service; exec liveness; `kv_relay` env from `krishiverse-worker-env`).
Scale to ≥1 replica; the advisory locks make >1 safe.

## ⛔ Deferred: domain-handler jobs (need the api business logic)
These jobs run **handler logic that lives in the `apps/api` modules** (Nest providers), which this standalone
pg process can't import cleanly:
- **Outbox relay EXECUTION** — `outbox-gauge` measures the backlog; running each event's *handler*
  (`OutboxHandlerRegistry`) requires the api domain.
- **Notification dispatch / digest / push / SMS-budget**, **settlement statement generation**, **mandi/weather
  ingest**, **KYC expiry**, **scheme sync** — all need module services.

**Decision required** (one of): (a) the **api** process runs the outbox dispatcher + these handler-jobs on an
internal timer (simplest — handlers are already there); or (b) extract a shared `@krishi-verse/domain` lib both
the api and worker import; or (c) the relay publishes to a bus (bullmq/SQS — already a worker dep) and a consumer
runs handlers. Until chosen, these remain in the api or unscheduled. Tracked as **P0-9-follow-on** in the backlog.
The 6 operational jobs above (the ones the P0-7 gap named: retention, partitions, recon, erasure, outbox-backlog)
**are** built and scheduled here.
