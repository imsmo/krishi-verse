# KRISHI-VERSE — BUILD PLAN (turning the skeleton into the platform)

**Read this with `apps/api/src/modules/listings/` open — that is the pattern every module copies.**

## The reality (so nobody is surprised)
- The repo is a **complete, correct skeleton**: ~250 DB tables (real SQL, seeded), 2,497 named files, one fully-built reference module (`listings`), and the laws/CI that keep it consistent.
- Filling it is **~400k–900k lines of code** = your Survival Guide's **9-month Phase-1 with a 6-person team**, then years for Phases 2-3.
- This plan makes that execution **systematic**: a fixed build order, a copy-paste pattern per module, AI-agent briefs, and gates so quality never drifts.

## Build order — dependency-respecting (do NOT reorder)
Foundations first; money early; then the Phase-1 revenue loop; defer the rest.

### WAVE 0 — Platform plumbing (no business value alone, everything depends on it)
| Order | Area | Where | Why first |
|---|---|---|---|
| 0.1 | `core/config`, `core/database` (pool, RLS session, uuid, partition-prune, txn) | apps/api/src/core | nothing runs without DB + tenant context |
| 0.2 | `core/tenancy-context`, `core/auth`, `core/rbac` | apps/api/src/core | every request needs tenant + identity + permission |
| 0.3 | `core/outbox`, `core/idempotency`, `core/http`, `core/cache` | apps/api/src/core | the laws (events, idempotency, envelope, cache) |
| 0.4 | `core/quota`, `core/resilience`, `core/backpressure` | apps/api/src/core | scale + safety wrappers |
| 0.5 | `apps/wallet-service` (ledger, accounts, recon, gRPC) | apps/wallet-service | money isolation — build before any module moves money |
| 0.6 | `apps/outbox-relay` | apps/outbox-relay | reliable events out |
| 0.7 | `packages/contracts`, `packages/config` | packages | shared DTOs/events + lint laws |

### WAVE 1 — Phase-1 revenue loop (the MVP: list → sell → pay → wage)
| Order | Module | Effort* | Notes |
|---|---|---|---|
| 1.1 | identity | L | users, dynamic RBAC, KYC, sessions, consent |
| 1.2 | tenancy | L | plans, subscriptions, settings, flags |
| 1.3 | catalogue | M | category tree + attributes (mostly admin CRUD) |
| 1.4 | **listings** | DONE | the reference module — already built |
| 1.5 | payments (+ wallet integration) | XL | the money path; CODEOWNERS-gated |
| 1.6 | orders | XL | multi-item, escrow, state machine, partial fulfil |
| 1.7 | auctions | L | real-time bids (pairs with realtime-gateway) |
| 1.8 | logistics (basic) | M | self-pickup + tenant delivery + OTP/POD |
| 1.9 | labour | XL | the differentiator; dignity CHECK, geofence, same-day wage |
| 1.10 | communication + notifications | M | templates, SMS/WhatsApp/push via worker |
| 1.11 | reviews, disputes | M | trust loop |
| 1.12 | ambassadors | M | onboarding + commissions |
| 1.13 | market-intel (mandi prices) | M | ingestion + read-model |
| 1.14 | land-soil-weather (weather only) | S | advisory push |
| 1.15 | admin-api (god mode core) | L | tenant approve/suspend/impersonate/billing |
| 1.16 | apps/realtime-gateway | M | live auctions/order tracking |
| 1.17 | apps/worker (Phase-1 jobs) | L | settlements, notifications, partitions, recon |
| 1.18 | apps/mobile (Phase-1 features) | XL | farmer/buyer/worker/ambassador screens |
| 1.19 | apps/web-tenant (Phase-1 routes) | L | the tenant console |

### WAVE 2 — Phase-2 modules (after MVP traction)
livestock, dairy, fintech, schemes, equipment, warehousing, contract-farming,
memberships, promotions, services-marketplace, requirements(full), offers(full),
stream-processor, whatsapp-bot, ivr-ussd-gateway, analytics-pipeline, web-partner, ai-services.

### WAVE 3 — Phase-3
exports, traceability(full), carbon, cells (international), federated learning.

*Effort: S=1-3 days · M=1-2 weeks · L=2-4 weeks · XL=4-8 weeks (one senior engineer/AI-pair).*

## Milestone gates (do not pass a gate with the previous one red)
- **G0 (end Wave 0):** a request flows api→DB with tenant context; wallet posts a balanced txn; outbox event published; CI green incl. tenant-isolation + ledger-invariant suites.
- **G1 (end Wave 1):** the full loop works end-to-end in staging — farmer lists (voice), buyer buys, escrow holds, delivery confirmed, seller paid, worker booked + same-day wage; 50 fake transactions, zero payment failures; load test k6-order-flow p95<500ms.
- **G2:** Phase-2 modules live; ONDC/WhatsApp; fintech first loan; k6-billion-scale model run against a staging cell.
- **G3:** Phase-3 + first international cell.

## The 1% that is already done carries the 99%
`listings` proves every pattern (state machine, BIGINT money, outbox-in-txn, idempotency, quota, shard router, read-model, tenant-isolation test). Every other module is "copy listings, change the entity, follow its README." That is why the skeleton matters: the hard *thinking* is finished; what remains is disciplined *typing*.
