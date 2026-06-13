# API Core (Wave 0 — build FIRST)

85 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `api`

### `apps/api/src/core/README.md` 
- **Layer:** API Core · core
- **Implement:** Core platform plumbing — no business logic. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/audit/audit.decorator.ts` 
- **Layer:** API Core · audit
- **Implement:** audit_log writer + @Audit decorator capturing old/new values for sensitive admin actions. Law8 partition pruning
- **Laws:** Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/api/src/core/audit/audit.module.ts` 
- **Layer:** API Core · audit
- **Implement:** audit_log writer + @Audit decorator capturing old/new values for sensitive admin actions. Law8 partition pruning, Law10 feature flag
- **Laws:** Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/audit/audit.writer.ts` 
- **Layer:** API Core · audit
- **Implement:** audit_log writer + @Audit decorator capturing old/new values for sensitive admin actions. Law8 partition pruning
- **Laws:** Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/api/src/core/auth/auth.guard.ts` 
- **Layer:** API Core · auth
- **Implement:** OTP request/verify, JWT issue/refresh (15m/30d), refresh-rotation, AuthGuard. OTPs live in Redis only. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/auth/auth.module.ts` 
- **Layer:** API Core · auth
- **Implement:** OTP request/verify, JWT issue/refresh (15m/30d), refresh-rotation, AuthGuard. OTPs live in Redis only. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/auth/jwt.strategy.ts` 
- **Layer:** API Core · auth
- **Implement:** OTP request/verify, JWT issue/refresh (15m/30d), refresh-rotation, AuthGuard. OTPs live in Redis only. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/auth/otp.service.ts` 
- **Layer:** API Core · auth
- **Implement:** OTP request/verify, JWT issue/refresh (15m/30d), refresh-rotation, AuthGuard. OTPs live in Redis only. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/auth/refresh-token.service.ts` 
- **Layer:** API Core · auth
- **Implement:** OTP request/verify, JWT issue/refresh (15m/30d), refresh-rotation, AuthGuard. OTPs live in Redis only. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/backpressure/README.md` 
- **Layer:** API Core · backpressure
- **Implement:** Load shedder + priority classifier (critical never shed) + concurrency limiter + queue-depth guard (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/backpressure/concurrency-limiter.ts` 
- **Layer:** API Core · backpressure
- **Implement:** Load shedder + priority classifier (critical never shed) + concurrency limiter + queue-depth guard (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/backpressure/load-shedder.ts` 
- **Layer:** API Core · backpressure
- **Implement:** Load shedder + priority classifier (critical never shed) + concurrency limiter + queue-depth guard (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/backpressure/priority-classifier.ts` 
- **Layer:** API Core · backpressure
- **Implement:** Load shedder + priority classifier (critical never shed) + concurrency limiter + queue-depth guard (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/backpressure/queue-depth-guard.ts` 
- **Layer:** API Core · backpressure
- **Implement:** Load shedder + priority classifier (critical never shed) + concurrency limiter + queue-depth guard (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/bulk/README.md` 
- **Layer:** API Core · bulk
- **Implement:** Core platform plumbing — no business logic. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/bulk/bulk-job.controller.ts` 
- **Layer:** API Core · bulk
- **Implement:** Core platform plumbing — no business logic. Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Laws:** Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/bulk/bulk-job.service.ts` 
- **Layer:** API Core · bulk
- **Implement:** Core platform plumbing — no business logic. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/bulk/bulk-result.store.ts` 
- **Layer:** API Core · bulk
- **Implement:** Core platform plumbing — no business logic. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/bulk/csv-import.processor.ts` 
- **Layer:** API Core · bulk
- **Implement:** Core platform plumbing — no business logic. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/cache/cache-keys.ts` 
- **Layer:** API Core · cache
- **Implement:** Redis client; ALL keys tenant-prefixed; TTL policies; never cache money/order state. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/cache/cache.module.ts` 
- **Layer:** API Core · cache
- **Implement:** Redis client; ALL keys tenant-prefixed; TTL policies; never cache money/order state. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/cache/redis.provider.ts` 
- **Layer:** API Core · cache
- **Implement:** Redis client; ALL keys tenant-prefixed; TTL policies; never cache money/order state. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/cells/README.md` 
- **Layer:** API Core · cells
- **Implement:** country/tenant→cell resolver + registry for international data-residency (Phase 3). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/cells/cell-registry.ts` 
- **Layer:** API Core · cells
- **Implement:** country/tenant→cell resolver + registry for international data-residency (Phase 3). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/cells/cell-resolver.ts` 
- **Layer:** API Core · cells
- **Implement:** country/tenant→cell resolver + registry for international data-residency (Phase 3). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/config/app-config.ts` 
- **Layer:** API Core · config
- **Implement:** Typed, validated config — the only reader of process.env; zod schema validates every var at boot (fail fast). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/config/config.module.ts` 
- **Layer:** API Core · config
- **Implement:** Typed, validated config — the only reader of process.env; zod schema validates every var at boot (fail fast). Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/config/env.validation.ts` 
- **Layer:** API Core · config
- **Implement:** Typed, validated config — the only reader of process.env; zod schema validates every var at boot (fail fast). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/database.module.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/database/partition-pruning.util.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/pg-pool.provider.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/read-only.decorator.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/read-replica.provider.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/rls-session.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/transaction.decorator.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/database/uuid.util.ts` 
- **Layer:** API Core · database
- **Implement:** PG pool via RDS Proxy; RLS session setter (SET app.tenant_id per txn); uuidv7 + uuid_v7_time partition-prune helpers; read-replica provider; @Transaction runner. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/feature-flags/flags.guard.ts` 
- **Layer:** API Core · feature-flags
- **Implement:** DB-backed flags + % rollout + kill-switch; FlagGuard (Law10). Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/feature-flags/flags.module.ts` 
- **Layer:** API Core · feature-flags
- **Implement:** DB-backed flags + % rollout + kill-switch; FlagGuard (Law10). Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/feature-flags/flags.service.ts` 
- **Layer:** API Core · feature-flags
- **Implement:** DB-backed flags + % rollout + kill-switch; FlagGuard (Law10). Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/health/health.controller.ts` 
- **Layer:** API Core · health
- **Implement:** Liveness/readiness probes (DB, redis, wallet-grpc reachable). Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Laws:** Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/health/readiness.indicator.ts` 
- **Layer:** API Core · health
- **Implement:** Liveness/readiness probes (DB, redis, wallet-grpc reachable). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/http/cursor-pagination.ts` 
- **Layer:** API Core · http
- **Implement:** Response envelope interceptor, exception filter (error codes), request-id, rate-limit guard, cursor pagination util. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/http/exception.filter.ts` 
- **Layer:** API Core · http
- **Implement:** Response envelope interceptor, exception filter (error codes), request-id, rate-limit guard, cursor pagination util. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/http/rate-limit.guard.ts` 
- **Layer:** API Core · http
- **Implement:** Response envelope interceptor, exception filter (error codes), request-id, rate-limit guard, cursor pagination util. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/http/request-id.middleware.ts` 
- **Layer:** API Core · http
- **Implement:** Response envelope interceptor, exception filter (error codes), request-id, rate-limit guard, cursor pagination util. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/http/response.interceptor.ts` 
- **Layer:** API Core · http
- **Implement:** Response envelope interceptor, exception filter (error codes), request-id, rate-limit guard, cursor pagination util. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/i18n/i18n.module.ts` 
- **Layer:** API Core · core
- **Implement:** Core platform plumbing — no business logic. Law7 i18n keys, Law10 feature flag
- **Laws:** Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/i18n/language.middleware.ts` 
- **Layer:** API Core · core
- **Implement:** Core platform plumbing — no business logic. Law7 i18n keys
- **Laws:** Law7 i18n keys
- **Priority:** Wave 0/1

### `apps/api/src/core/i18n/translation.service.ts` 
- **Layer:** API Core · core
- **Implement:** Core platform plumbing — no business logic. Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys
- **Priority:** Wave 0/1

### `apps/api/src/core/idempotency/idempotency.middleware.ts` 
- **Layer:** API Core · idempotency
- **Implement:** Idempotency-Key middleware + store (24h); duplicate mutation returns cached result (Law3). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/idempotency/idempotency.store.ts` 
- **Layer:** API Core · idempotency
- **Implement:** Idempotency-Key middleware + store (24h); duplicate mutation returns cached result (Law3). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/media/media-links.service.ts` 
- **Layer:** API Core · media
- **Implement:** S3 presign, scan-webhook, media_links attach; EXIF strip + dedupe hooks. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/media/media.module.ts` 
- **Layer:** API Core · media
- **Implement:** S3 presign, scan-webhook, media_links attach; EXIF strip + dedupe hooks. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/media/s3-presign.service.ts` 
- **Layer:** API Core · media
- **Implement:** S3 presign, scan-webhook, media_links attach; EXIF strip + dedupe hooks. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/media/scan-webhook.controller.ts` 
- **Layer:** API Core · media
- **Implement:** S3 presign, scan-webhook, media_links attach; EXIF strip + dedupe hooks. Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Laws:** Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/outbox/event-envelope.ts` 
- **Layer:** API Core · outbox
- **Implement:** OutboxWriter that inserts an event row in the SAME txn as the business write (Law4); event envelope schema. Law4 outbox in same txn, Law8 partition pruning
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/api/src/core/outbox/outbox.module.ts` 
- **Layer:** API Core · outbox
- **Implement:** OutboxWriter that inserts an event row in the SAME txn as the business write (Law4); event envelope schema. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/outbox/outbox.writer.ts` 
- **Layer:** API Core · outbox
- **Implement:** OutboxWriter that inserts an event row in the SAME txn as the business write (Law4); event envelope schema. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/quota/limit-alerts.ts` 
- **Layer:** API Core · quota
- **Implement:** Plan-limit enforcement: QuotaGuard + usage-meter (UPSERT usage_counters) + 80% alerts. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/quota/quota.guard.ts` 
- **Layer:** API Core · quota
- **Implement:** Plan-limit enforcement: QuotaGuard + usage-meter (UPSERT usage_counters) + 80% alerts. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/quota/usage-meter.service.ts` 
- **Layer:** API Core · quota
- **Implement:** Plan-limit enforcement: QuotaGuard + usage-meter (UPSERT usage_counters) + 80% alerts. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/rbac/permissions.decorator.ts` 
- **Layer:** API Core · rbac
- **Implement:** Dynamic RBAC from DB roles/permissions; PermissionsGuard + @RequirePermission; role-permission cache. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/rbac/permissions.guard.ts` 
- **Layer:** API Core · rbac
- **Implement:** Dynamic RBAC from DB roles/permissions; PermissionsGuard + @RequirePermission; role-permission cache. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/rbac/rbac.module.ts` 
- **Layer:** API Core · rbac
- **Implement:** Dynamic RBAC from DB roles/permissions; PermissionsGuard + @RequirePermission; role-permission cache. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/rbac/role-cache.service.ts` 
- **Layer:** API Core · rbac
- **Implement:** Dynamic RBAC from DB roles/permissions; PermissionsGuard + @RequirePermission; role-permission cache. Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/api/src/core/resilience/README.md` 
- **Layer:** API Core · resilience
- **Implement:** Circuit breaker / bulkhead / retry+jitter / timeout / fallback registry around every external dep (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/resilience/bulkhead.ts` 
- **Layer:** API Core · resilience
- **Implement:** Circuit breaker / bulkhead / retry+jitter / timeout / fallback registry around every external dep (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/resilience/circuit-breaker.ts` 
- **Layer:** API Core · resilience
- **Implement:** Circuit breaker / bulkhead / retry+jitter / timeout / fallback registry around every external dep (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/resilience/fallback.registry.ts` 
- **Layer:** API Core · resilience
- **Implement:** Circuit breaker / bulkhead / retry+jitter / timeout / fallback registry around every external dep (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/resilience/retry.ts` 
- **Layer:** API Core · resilience
- **Implement:** Circuit breaker / bulkhead / retry+jitter / timeout / fallback registry around every external dep (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/resilience/timeout.interceptor.ts` 
- **Layer:** API Core · resilience
- **Implement:** Circuit breaker / bulkhead / retry+jitter / timeout / fallback registry around every external dep (Law12). Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/search/index-builders/listings.index.ts` 
- **Layer:** API Core · search
- **Implement:** OpenSearch client + per-index builders; consumes outbox to keep indexes in sync. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/search/index-builders/products.index.ts` 
- **Layer:** API Core · search
- **Implement:** OpenSearch client + per-index builders; consumes outbox to keep indexes in sync. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/search/index-builders/workers.index.ts` 
- **Layer:** API Core · search
- **Implement:** OpenSearch client + per-index builders; consumes outbox to keep indexes in sync. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/search/opensearch.client.ts` 
- **Layer:** API Core · search
- **Implement:** OpenSearch client + per-index builders; consumes outbox to keep indexes in sync. general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/search/search.module.ts` 
- **Layer:** API Core · search
- **Implement:** OpenSearch client + per-index builders; consumes outbox to keep indexes in sync. Law10 feature flag
- **Laws:** Law10 feature flag
- **Priority:** Wave 0/1

### `apps/api/src/core/sharding/README.md` 
- **Layer:** API Core · sharding
- **Implement:** tenant_id→shard router, shard map, per-shard pools, cross-shard guard, directory-db client. No-op at shard_count=1; flip to scale. Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/sharding/cross-shard-query.guard.ts` 
- **Layer:** API Core · sharding
- **Implement:** tenant_id→shard router, shard map, per-shard pools, cross-shard guard, directory-db client. No-op at shard_count=1; flip to scale. Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/sharding/directory-db.client.ts` 
- **Layer:** API Core · sharding
- **Implement:** tenant_id→shard router, shard map, per-shard pools, cross-shard guard, directory-db client. No-op at shard_count=1; flip to scale. Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/sharding/shard-map.ts` 
- **Layer:** API Core · sharding
- **Implement:** tenant_id→shard router, shard map, per-shard pools, cross-shard guard, directory-db client. No-op at shard_count=1; flip to scale. Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/sharding/shard-pool.manager.ts` 
- **Layer:** API Core · sharding
- **Implement:** tenant_id→shard router, shard map, per-shard pools, cross-shard guard, directory-db client. No-op at shard_count=1; flip to scale. Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/sharding/shard-router.ts` 
- **Layer:** API Core · sharding
- **Implement:** tenant_id→shard router, shard map, per-shard pools, cross-shard guard, directory-db client. No-op at shard_count=1; flip to scale. Law12 degrade-not-die / scale
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/api/src/core/tenancy-context/tenant-context.middleware.ts` 
- **Layer:** API Core · tenancy-context
- **Implement:** Resolve tenant from JWT+domain, store in async-local context, set app.tenant_id on every query (Law1 backbone). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/tenancy-context/tenant-context.storage.ts` 
- **Layer:** API Core · tenancy-context
- **Implement:** Resolve tenant from JWT+domain, store in async-local context, set app.tenant_id on every query (Law1 backbone). general
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/src/core/tenancy-context/tenant-resolver.ts` 
- **Layer:** API Core · tenancy-context
- **Implement:** Resolve tenant from JWT+domain, store in async-local context, set app.tenant_id on every query (Law1 backbone). general
- **Laws:** general
- **Priority:** Wave 0/1
