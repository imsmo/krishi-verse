# Krishi-Verse — Module Build Status

Single source of truth for build progress. Update every session.
Legend: ⬜ not started (stub) · 🟡 in progress · ✅ done (tsc clean + unit + integration tests green, registered in app.module, README written).

A module is **✅ only when**: domain invariants + state machine, repo (tenant_id everywhere, optimistic lock), service (UoW tx + outbox-in-tx + idempotency + quota + enforced authz + metrics), controller (guards + zod + idempotency + versioned), typed errors, unit + tenant-isolation + integration(RLS) tests, slice SQL, README — all per the Build Playbook §4 Definition of Done.

## Core platform (Track A)
| Area | Status | Notes |
|---|---|---|
| database (UoW/RLS/pools/replica/shard-router) | ✅ | concrete Postgres impls |
| outbox writer | ✅ | Pg, writes in-tx |
| quota / idempotency / cache / metrics | ✅ | Pg + Redis/in-memory + Prom |
| auth guards + tenant-context + RBAC guard | ✅ | JWT verify; perms from claims |
| http (exception filter, response envelope, request-id, zod) | ✅ | |
| config / health | ✅ | |
| audit-log writer | ✅ | built with identity |
| rate-limit guard | ⬜ | hardening batch 1 |
| feature-flags | ⬜ | hardening batch 1 |
| i18n | ⬜ | hardening batch 1 |
| media / S3 presign | ⬜ | hardening batch 1 |
| RBAC role-cache (DB-backed perms) | ✅ | built with identity |
| auth login (OTP, refresh token, jwt.strategy) | ✅ | built with identity |
| resilience (circuit-breaker/retry/bulkhead/timeout) | ⬜ | before `payments`/launch |
| backpressure (load-shedder/priority/concurrency) | ⬜ | before first big load |
| sharding execution (pool-mgr/directory/cross-shard) | ⬜ | Phase 3 trigger |
| OpenSearch index-builders | ⬜ | Phase 2 |
| bulk CSV import | ⬜ | when needed |
| cells (per-country) | ⬜ | Phase 4 |

## Business modules (Track B)
| # | Module | Wave | Status |
|---|---|---|---|
| 1 | identity | 1 | ✅ |
| 2 | catalogue | 1 | ⬜ |
| 3 | **listings** | 1 | ✅ |
| 4 | orders | 1 | ⬜ |
| 5 | payments (+ wallet-service) | 1 | ⬜ |
| 6 | auctions | 2 | ⬜ |
| 7 | offers | 2 | ⬜ |
| 8 | requirements | 2 | ⬜ |
| 9 | logistics | 2 | ⬜ |
| 10 | reviews | 2 | ⬜ |
| 11 | disputes | 2 | ⬜ |
| 12 | promotions | 2 | ⬜ |
| 13 | memberships | 2 | ⬜ |
| 14 | labour | 3 | ⬜ |
| 15 | livestock | 3 | ⬜ |
| 16 | dairy | 3 | ⬜ |
| 17 | equipment | 3 | ⬜ |
| 18 | warehousing | 3 | ⬜ |
| 19 | contract-farming | 3 | ⬜ |
| 20 | exports | 3 | ⬜ |
| 21 | land-soil-weather | 3 | ⬜ |
| 22 | fintech | 3 | ⬜ (gated on RBI/partner) |
| 23 | schemes | 3 | ⬜ (gated on PFMS/DBT) |
| 24 | communication | 4 | ⬜ |
| 25 | education | 4 | ⬜ |
| 26 | cms | 4 | ⬜ |
| 27 | support | 4 | ⬜ |
| 28 | ambassadors | 4 | ⬜ |
| 29 | market-intel | 4 | ⬜ |
| 30 | traceability | 4 | ⬜ |
| 31 | ai-governance | 4 | ⬜ |
| 32 | tenancy | 1* | ⬜ (SaaS plans/subscriptions/billing — needed early for quota) |
| 33 | services-marketplace | 3 | ⬜ |

## Apps / surfaces
| Surface | Status |
|---|---|
| apps/api (modular monolith) | 🟡 (listings live) |
| apps/wallet-service | ⬜ |
| apps/web-storefront | ⬜ |
| apps/web-tenant / web-admin / web-partner | ⬜ |
| apps/mobile (React Native) | ⬜ |
| apps/realtime-gateway | ⬜ (Phase 2) |
| apps/stream-processor | ⬜ (Phase 2) |
| apps/ai-services | ⬜ (Phase 2) |

\* `tenancy` (plans, subscriptions, plan_limits, billing) is technically Wave 1 because `quota` reads it — build it alongside/just after `identity`.
