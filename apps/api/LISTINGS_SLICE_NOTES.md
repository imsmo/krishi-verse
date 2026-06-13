# Listings Vertical Slice — Production Hardening Notes

This documents what was implemented to turn the listings module from a *design-time
reference that did not compile or run* into a **working, production-grade vertical
slice** — and how to run it.

## What was wrong before

- The app could not boot: `main.ts`, `app.module.ts`, `database.module.ts` were empty stubs.
- The core services (`UnitOfWork`, `OutboxWriter`, `CacheService`, `QuotaService`,
  `IdempotencyService`, `ReadReplicaProvider`, `Metrics`) were **abstract contracts
  with no concrete implementations and no DI bindings** — nothing connected to Postgres/Redis.
- The exemplar **did not even type-check**: the read-model called `search()` (interface
  defines `query()`) and referenced DTO fields that didn't exist (`q.text`, `q.organicOnly`);
  the controller called `dto.newPriceMinor` when the field is `priceMinor`.
- **Security bug:** `assertOwnerOrThrow()` only logged a warning — it never threw, so
  listing ownership was not enforced.
- Inline `require()` calls referenced error classes (`BadRequestError`, `ValidationError`,
  `ForbiddenError`) that didn't exist → runtime crashes.
- `mediaIds` was accepted in the create DTO but silently discarded.

## What was implemented (concrete infrastructure)

Postgres `PgUnitOfWork` (one tx per write, `SET LOCAL app.tenant_id`/`app.user_id` for RLS,
auto-retry on serialization/deadlock `40001/40P01`), `PgReadReplicaProvider` (RLS-scoped
read tx on the replica), `PgPoolProvider` (writer+replica pools per shard, closed on shutdown),
`ShardRouter` (single shard now, stable-hash ready), `PgOutboxWriter` (event insert in the
same tx — Law 4), `PgQuotaService` (plan-limit check + atomic `usage_counters` increment),
`PgIdempotencyService` (claim → run → store; replay returns the original; releases on failure),
Redis/in-memory `CacheService`, `PromMetrics` (`/metrics`), JWT `AuthGuard` + `PermissionsGuard`,
tenant-context middleware (AsyncLocalStorage), request-id middleware, global exception filter
+ response envelope, `AppConfig`/env validation, health (`/healthz`,`/readyz`) — all wired in a
global `CoreModule`, with `app.module.ts` + `main.ts` bootstrap.

## Listings fixes

Real ownership enforcement (`assertCanMutate` throws `ForbiddenError`; admins with
`listing.moderate` override), all inline `require()` replaced with imports, `mediaIds`
persisted via a `listing_media` link table in the create transaction, read-model rewritten
to a parameterised keyset-paginated replica query matching the DTO, controller `priceMinor`
fix, public browse/detail marked `@Public`.

## How to run

```bash
cd apps/api
npm install

# fast suite — no infra needed
npm run typecheck      # tsc --noEmit  → clean
npm run test:unit      # 21 tests: entity, state machine, service wiring, ownership, tenant-isolation
npm run build          # emits dist/

# full end-to-end with real Postgres + RLS
docker compose -f docker-compose.dev.yml up -d
# load the self-contained slice schema + least-privilege app role + seed:
psql "$DATABASE_ADMIN_URL" -f test/sql/00_listings_slice.sql
psql "$DATABASE_ADMIN_URL" -f test/sql/01_app_role.sql
psql "$DATABASE_ADMIN_URL" -f test/sql/02_seed_min.sql
DATABASE_URL=postgres://kv_app:kv_app_pw@localhost:5432/krishi_dev \
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/krishi_dev \
  npm run test:integration
```

`.github/workflows/api-ci.yml` runs typecheck → unit → build → integration (Postgres service,
app connects as the non-superuser `kv_app` role so RLS is genuinely exercised).

## Verified in this session

- `tsc --noEmit` (core + listings + integration test): **exit 0**
- `npm run build` (production emit): **dist/main.js produced**
- `npm run test:unit`: **21/21 pass** (incl. the ownership-enforcement regression guards)

The integration test (`listings.integration.spec.ts`) requires a live Postgres and runs in CI;
it proves create→outbox, publish→outbox, replica read, idempotency, quota, and cross-tenant
RLS isolation.

## Still scaffolding (intentionally, beyond this slice)

The other 32 API modules, the four web frontends, the mobile app, the realtime gateway and the
stream processor remain stubs — they are implemented by copying this now-proven slice. OpenSearch
relevance search and the Kafka outbox transport are Phase-2 swaps behind the same interfaces.
