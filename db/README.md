# db/ — single source of schema truth

The database structure is defined by the migrations in `migrations/`, which are a
**faithful, verbatim reproduction** of `../Database_Architecture/full_platform/*.sql`
(the canonical design): ~250 tables, 32 partitioned hot tables, 30 enums, the
UUIDv7 / tenant / audit helper functions, and the RLS + partition automation.

## Layout
- `migrations/0001..0015_*.sql` — ordered, immutable schema migrations. Each mirrors one
  `full_platform` file. The outer `BEGIN;/COMMIT;` are removed because the runner wraps
  each migration in its own transaction together with its bookkeeping row.
- `seeds/` — master/reference data, applied AFTER migrations:
  - `core/` languages, geo (GJ/MH), currencies+units, roles+permissions, lookups, consent, notifications, settings
  - `rules/` plans+limits, commission, GST/TDS tax, charges, membership tiers, min wages, ambassador plans, schemes
  - `catalogue/` category tree, attributes/options, 30 launch crops, templates, synonyms
  - `demo/` staging-only fake tenants/users/listings (NEVER applied when NODE_ENV=production)
- `scripts/` — `migrate.js`, `seed.js`, `ensure-partitions.js` (cron), `archive-partitions.js`, `verify-rls-coverage.js`
- `dba/` — operational SQL/runbooks (bloat, locks, replication lag, RLS verify, slow queries, failover)

## Roles (important)
The application connects as the least-privilege **`kv_app`** role (subject to RLS).
**Migrations and seeds run as the schema OWNER** (a separate, privileged role) via
`MIGRATION_DATABASE_URL`. Never run the app as the owner.

## Usage
```bash
# point at a DDL-capable role
export MIGRATION_DATABASE_URL=postgres://owner:pw@host:5432/krishi

pnpm migrate            # apply all pending migrations (atomic, tracked, idempotent)
pnpm migrate:status     # applied vs pending
pnpm migrate:plan       # list migrations + checksums (no DB)
pnpm seed               # core + rules + catalogue (idempotent)
pnpm seed:demo          # also demo data (blocked when NODE_ENV=production)
```

## Rules
- **Migrations are immutable.** Never edit an applied migration — the runner stores a
  checksum and will refuse to proceed if a recorded migration's content changed. To change
  the schema, add a NEW numbered migration (e.g. `0016_*.sql`).
- Migrations are applied **in filename order**, each in a single transaction, recorded in
  `schema_migrations`. A failure rolls back fully.
- CI (`.github/workflows/db-migrate.yml`) applies every migration to a fresh Postgres on
  each change and verifies idempotency — the schema is proven to build continuously.

## Ops scripts are production-grade (not throwaway utilities)
`scripts/lib/` is a shared toolkit used by every script:
- `db.js` — hardened pg connection (statement/lock/idle timeouts ALWAYS set, connect
  retry+backoff, SSL via PGSSLMODE, guaranteed close);
- `log.js` — structured JSON logging (CloudWatch/Datadog) with pretty TTY mode;
- `job.js` — `ops_job_runs` lifecycle + advisory lock so two cron pods can't double-run;
- `args.js` — CLI parsing + `--help`; `partitions.js` — pure, unit-tested date/bound math.

Scripts: `ensure-partitions` (creates future partitions + asserts ≥N months runway),
`archive-partitions` (retention-driven, dry-run by default, lock-timeout-safe, batched),
`verify-rls-coverage` (tenant-isolation CI gate + money-table grant control),
`explain-top-queries` (pg_stat_statements triage). Unit tests in `scripts/__tests__/`
(`pnpm db:test`); CI (`db-migrate.yml`) runs them AND executes the scripts against a real
Postgres after migrating, so the whole DB layer is proven end to end on every change.
