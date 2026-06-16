# START HERE — what to build next & how to command it

This is the single front door. If you're ever unsure what to do, read this. Depth lives
in `../Krishi_Verse_Build_and_Command_Playbook.md`; this page is the decision + the exact words to paste.

---

## 1. Where the build stands (one screen)

**Done & verified:** database schema (canonical `Database_Architecture/full_platform`),
all 15 migrations + runner + seeds, `db/dba` + `db/scripts` (hardened, tested), the whole
monorepo structure (24 workspaces, root tooling), and core platform plumbing for the
`listings` slice. **`listings` is the fully-built reference module.**

**Not done:** 32 business modules (scaffolded, services empty), ~55 core files
(resilience, backpressure, audit, rate-limit, feature-flags, i18n, media, DB-backed RBAC,
auth-login, etc.), the wallet-service, frontends, mobile, realtime/stream/AI services.

**So the job from here = build modules one at a time, each to the `listings` bar, hardening
the bit of core each one needs just before it.** Track progress in `apps/api/MODULE_STATUS.md`.

---

## 2. THE BIG IDEA: why output sometimes feels "local-level", and the fix

You noticed that a first pass can come out thinner than production-grade. The reason: without
an explicit bar, an AI optimizes for "works" not "withstands millions of users." The fix is a
**contract you paste with every command** + **a rule that nothing is "done" without proof
(green typecheck/tests/build)**. Do these two things and the output stays at the `listings` bar.

### 2a. The Production-Grade Contract — paste this at the TOP of every build command

```
PRODUCTION-GRADE CONTRACT (obey for everything you build here):
- This is a large-scale multi-tenant SaaS for millions of users and billions of ops. Write
  code that withstands that scale — not a demo.
- Match the established reference: for API modules, `apps/api/src/modules/listings` is the law;
  for core infra, the implemented `*.pg.ts` files (e.g. core/database/unit-of-work.pg.ts);
  for scripts, db/scripts/lib + its tests. Mirror their layering, naming, and rigor.
- NO stubs, NO TODOs, NO placeholders, NO "left as an exercise". If something you need is
  missing, build it or explicitly flag it — never fake it or silently skip.
- Bake in, every time: tenant isolation (tenant_id + RLS), one ACID tx per write via
  UnitOfWork, domain events to the outbox IN THE SAME TX, idempotency on mutations, optimistic
  locking, enforced authorization (THROW, never just log), quota, structured errors with stable
  codes, metrics, input validation. Money is always bigint minor units, only in wallet-service.
- Handle failure: timeouts, retries with backoff, concurrency, partial failure, bad input.
- Tests are mandatory: unit (invariants + state machine) + an integration test against real
  Postgres proving cross-tenant RLS isolation. No "tests" that mock everything and prove nothing.
- Before you say "done": run `npm run typecheck`, `npm run test:unit`, `npm run build` and the
  module's integration test; SELF-AUDIT against this contract and the Playbook §4.2 bug list;
  then paste the actual green output. If anything is red, it is NOT done.
- If a scale/architecture trade-off is ambiguous, choose the option a top SaaS company would
  ship and state the assumption. Prefer correctness and clarity over cleverness.
```

### 2b. Your acceptance loop (do this after I deliver — never accept on faith)
```bash
cd apps/api && npm run typecheck && npm run test:unit && npm run build
npm run test:integration          # needs local Postgres (docker compose -f docker-compose.dev.yml up -d)
```
Then skim the diff for the 8 recurring bug classes in Playbook §4.2 (non-throwing guards,
DTO/field mismatches, schema/column mismatches, inline require, float money, missing tenant_id,
events outside the tx, fake tests). If any fail, reply:
*"This violates the Production-Grade Contract / DoD item X and diverges from listings at <file>. Fix and re-verify."*

---

## 3. THE EXACT COMMAND TO PASTE NEXT (build `identity`)

Copy everything below into your next message to me:

```
[PASTE THE PRODUCTION-GRADE CONTRACT FROM §2a HERE]

Build the `identity` module to full production grade, exactly matching the
apps/api/src/modules/listings reference — same layering, patterns, and test bar.

Before coding, read in full: apps/api/src/modules/listings, CLAUDE.md (the 10 Laws),
apps/api/src/core (use core contracts by token), and the canonical schema
db/migrations/0003_identity_access.sql (match column names EXACTLY; flag any mismatch).

Implement the identity domain per PRD module M01: users (phone-centric identity),
roles + permissions + user_tenant_roles (multi-role per person, per tenant), KYC documents,
addresses, bank accounts, devices, sessions, login_events, and consents (DPDP).
Cover these use-cases: register/lookup user, assign/revoke role, grant/check permission,
submit/verify KYC, add/verify device, open/close session, record consent (append-only).

Also harden the core that identity depends on (to listings/.pg.ts quality, with tests):
- core/rbac/role-cache.service.ts — resolve a user's effective permissions from the DB
  (role grants + per-user overrides), cached with invalidation, so permissions stop being
  trusted blindly from the JWT.
- core/auth: otp.service.ts, refresh-token.service.ts, jwt.strategy.ts — the real phone-OTP
  login + refresh flow that mints the JWT the AuthGuard consumes.
- core/audit/audit.writer.ts (+ module/decorator) — append-only audit_log writes for
  identity-sensitive actions (role change, KYC approve, consent change).

Definition of Done = Playbook §4.1 (domain invariants + state machines, tenant_id in every
query + RLS, UnitOfWork tx + outbox-in-tx + idempotency + enforced authz + metrics, zod DTOs,
versioned controllers, typed errors, unit + tenant-isolation + real-Postgres integration test
with RLS, slice SQL under apps/api/test/sql, README). Register in app.module.ts. Update
apps/api/MODULE_STATUS.md. Then run typecheck + tests + build and paste the green output.
```

That single message produces a complete, verified `identity` module + the core it needs.

---

## 4. The order after `identity` (so you're never unsure)

Build one per session, each with the §2a contract + §3-style command (swap the module name,
its `db/migrations/0xxx_*.sql` schema file, PRD module id, and use-cases):

1. ✅ listings (reference)
2. **identity** ← you are here
3. **tenancy** (plans, subscriptions, plan_limits, tenant settings — `quota` reads these)
4. **catalogue** (products, categories, attributes — listings references these)
5. **orders** (cart → checkout → order → fulfilment)
6. **wallet-service + payments** (money core; isolated; highest-risk — go slow, test hardest)
7. Wave 2: auctions → offers → requirements → logistics → reviews → disputes → promotions → memberships
8. Wave 3 (each gated on its regulator, behind feature flags): labour → livestock → dairy →
   equipment → warehousing → contract-farming → exports → land-soil-weather → fintech → schemes
9. Wave 4: communication → education → cms → support → ambassadors → market-intel → traceability → ai-governance
10. Interleave core hardening before the scale events that need it (Playbook §5–6): resilience +
    backpressure + observability + load test **before launch**; OpenSearch + streaming + realtime +
    sharding **for Phase 2–3**.
11. Frontends in parallel once the spine is stable: web-storefront → web-tenant → mobile → web-admin → web-partner.

When you finish a module, your next message is simply the §3 command with the next module's name.

---

## 4.5 Frontend & design — where they fit (DON'T build mobile/web screens yet)

`apps/mobile/src/features/*` (farmer-home, buyer-browse, listings-create, vet, dairy, …) is
**mobile app CODE, not design.** It's a feature-sliced React Native structure (each folder =
one role/journey with `screens/ components/ api.ts store.ts`), currently all stubs. The actual
**design** is the 196 HTML screens + tokens in `Phase-1 all screen design/`.

The real dependency chain is: **design (mostly done) → API modules (in progress) → shared UI
component library (`packages/ui` + `packages/ui-native`, ~6 components each so far) → the
mobile/web screens (not started).** Screens are LAST because they consume the API and the
component library. Building them now — against endpoints that don't exist and designs that only
cover half the roles — guarantees rework. So:

- **Critical path stays the API** (identity → … → payments). Don't pause it for the frontend.
- **Design is a parallel, non-blocking track.** It's largely complete for the Phase-1 lean roles
  (farmer/buyer/worker/tenant/ambassador). Known gaps to close *when you invest in design*, not now:
  only 3 of 12 languages are production-ready; several screens use 9–10px fonts (too small for
  rural/older users — lift to ≥12px); and there are **no designs yet for Phase-2/3 roles**
  (vet, mcc-operator, dairy, livestock, fintech, vyapari, fpo-coordinator, store-owner, education)
  — which is correct, since those are deliberately deferred per your lean Phase-1.
- **Optional frontend progress you CAN make now (design-driven, not API-blocked):** grow the
  `packages/ui-native` + `packages/ui` component libraries from the design tokens. This speeds up
  every future screen and doesn't wait on the API.
- **First real screen work** = one thin `web-storefront` slice (browse published `listings`) AFTER
  `catalogue` + `orders` exist — to validate the API contract end-to-end and finally *see* it work.
  Then build mobile features role-by-role, each AFTER its API module ships.

Bottom line: **do not start `mobile/src/features` now.** Continue with `identity` (§3).

---

## 5. Two rules that keep quality high
1. **One module per session.** Never "build 5 modules" — quality drops and you can't review it.
2. **Nothing is done without green proof.** typecheck + tests + build, every time. CI
   (`.github/workflows/api-ci.yml` + `db-migrate.yml`) is your automated enforcer — never merge red.

*North star: when in doubt, make it look like `listings`.*
