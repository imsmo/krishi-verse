# Labour (M28) — dignified-work spine

Booking marketplace for farm labour, built to the platform laws. An **employer** (farmer/FPO, `worker.book`)
posts a booking, **assigns** workers, workers **consent**, and on completion **wages settle through the
wallet**. Gated by the **`labour`** feature flag (default **OFF**).

## The dignity floor (the headline invariant)
A booking's offered wage may **never** fall below the statutory **minimum wage** for its region + skill
level. This is enforced in **three** places, fail-closed:
1. `MinimumWageService.resolveFloor()` snapshots the floor from `minimum_wages` at posting (if **no** row
   is configured, the booking is **rejected** — we never silently allow a sub-floor wage).
2. The `LabourBooking.post()` aggregate throws `WAGE_BELOW_MINIMUM` (422) if the offer is below the snapshot.
3. The database `chk_dignity_floor CHECK (wage_offered_minor >= min_wage_minor)` is the physics backstop.

## The money path (Law 2 — wallet boundary only)
Wage settlement (`POST /v1/labour/bookings/:id/pay`, `completed → paid`) transfers each accepted worker's
agreed wage **employer `userMain` → worker `userMain`**, `txnType = 'wage_payout'`, as a **zero-sum,
idempotent** ledger txn (`wage:<assignmentId>`). The wallet's no-overdraw rule means the employer must
actually hold the balance. Labour never touches the ledger directly.

## Lifecycle (Law 5 — state machines in `domain/*.state.ts`)
- **Booking**: `open → in_progress → completed → paid` (+ `cancel` from open/in_progress, `expire` from open).
  `labour_bookings` has a **version** column → updates are an **optimistic compare-and-swap**.
- **Assignment** (one row per worker): `pending_worker → accepted | rejected | expired`; `accepted → paid`.
  No version column → rows lock **FOR UPDATE**. Worker consent is required (PRD §31.5).
- **Worker**: `age_verified_18` is a **HARD** gate — `assertAssignable()` throws until an admin/KYC verifies.

## Endpoints
- `POST /v1/labour/workers` — self-register (idempotent); `GET/PATCH /v1/labour/workers/me`;
  `GET /v1/labour/workers[/:id]` (employer browse, `worker.book`).
- `POST /v1/labour/bookings` (idempotent) · `GET /v1/labour/bookings[?box=mine|open|all]` · `GET /:id`
  · `POST /:id/assignments` (idempotent) · `POST /:id/{start,complete,cancel}` · `POST /:id/pay` (idempotent).
- `GET /v1/labour/assignments[?box=mine|booking]` · `GET /:id` · `POST /:id/respond` (worker accept/reject).

## Guarantees per write
One ACID tx (UoW) · outbox events in the **same** tx (Law 4) · idempotency on money/create mutations
(Law 3) · quota on create (`labour_bookings`) · authz that **throws** (Law 6: `worker.book` employer +
booking-owner/`booking.manage`) · tenant_id in every query + RLS (Law 1) · keyset pagination (never OFFSET).

## Jobs
`booking-respond-timeout.job.ts` — expires OPEN bookings past `respond_by` (and lapses pending assignments),
cross-tenant via the kv_relay pool, `FOR UPDATE SKIP LOCKED`, idempotent.

## Events (outbox)
`labour.worker_registered/updated`, `labour.booking_posted/started/completed`, `labour.worker_assigned`,
`labour.assignment_accepted/rejected/expired`, `labour.wages_paid`, `labour.booking_cancelled/expired`.

## Scope & deferrals
**In scope:** worker profiles, bookings (dignity floor), assignments (consent), wage settlement, respond-timeout job.
**Deferred (schema exists in 0008, not yet wired):** attendance (geo-fenced/dual-confirmed, *partitioned*),
worker advances/baki, insurance enrolment, MGNREGA job cards, migrant engagement, safety checklists,
grievances, crews + sardar profiles, worker availability/skills matrices, **skills & minimum-wage admin CRUD +
gazette-sync job**, voice-consent capture, auto-accept, women-only matching, attendance-derived overtime pay.

## Tests
- `__tests__/labour-booking.spec.ts` — domain: both state machines, the dignity floor, wage settlement, age gate, min-wage VO.
- `__tests__/worker-profile.service.spec.ts` — one-profile guard, outbox-in-tx, edit ownership.
- `__tests__/tenant-isolation.spec.ts` — SQL contract (tenant_id binding, optimistic version, FOR UPDATE, keyset, SKIP LOCKED, global min-wage).
- `__tests__/labour.integration.spec.ts` — real Postgres: register → age-verify → dignity-floor rejection → post → assign → accept → start → complete → **pay (wallet zero-sum)** → RLS cross-tenant.

> No Postgres in the sandbox, so the live RLS / zero-sum wage-payout assertions run on the first CI run with a service container.
