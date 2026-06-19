# Warehousing & WDRA receipts (M21) — storage + eNWR

Deposit produce in an accredited warehouse, get a quality assay, receive an **electronic Negotiable
Warehouse Receipt (eNWR)** (later usable as loan collateral), and pay a storage fee on release. Built to the
platform laws. Gated by the **`warehousing`** feature flag (default **OFF**).

## The money path (Law 2 — wallet boundary only)
Storage-fee settlement (`POST /v1/warehousing/storage-bookings/:id/release`, `stored → released`) collects
`quantity × rate_per_qtl_month × months` from the **depositor `userMain` → warehouse-operator `userMain`**,
`txnType 'storage_fee'`, a **zero-sum, idempotent** ledger txn (`storagefee:<bookingId>`). A free (zero-rate)
warehouse moves no money; a fee-bearing warehouse with no operator **fails closed** (`NO_WAREHOUSE_OPERATOR`).

## Money correctness — float-free (Law: never float)
`storageFeeMinor = quantity(qtl) × rate/qtl/month × months` with **exact bigint arithmetic**: quantity is a
scaled integer (×1000) and the fee = `qtyMilli × rate × months / 1000` with round-half-up integer division.
Months stored = `ceil(days/30)`, minimum 1, from `stored_at`.

## Lifecycle (Law 5 — `domain/*.state.ts`)
- **Storage booking**: `requested → confirmed → stored → released` (+ cancel from requested/confirmed).
- **eNWR**: `issued → released | cancelled`. Pledge → loan-collateral → partial-release → default is the
  **deferred fintech flow** (those transitions are intentionally unreachable here).
- No version columns → mutations lock the row **FOR UPDATE**.

## Endpoints
- `POST /v1/warehousing/warehouses` (idempotent, `warehouse.manage`) · `GET` (?box=mine|browse|all) · `GET /:id` · `PATCH /:id`.
- `POST /v1/warehousing/storage-bookings` (request, idempotent, `warehouse.store`) · `GET` (?box) · `GET /:id`
  · `POST /:id/{confirm,store}` (operator) · `POST /:id/release` (operator, idempotent, money) · `POST /:id/cancel`
  · `POST /:id/assays` (operator) · `GET /:id/assays`.
- `POST /v1/warehousing/nwr` (issue, idempotent, `warehouse.manage`) · `GET` (?box=mine|all) · `GET /:id` · `POST /:id/{release,cancel}`.

## Threats considered
- **No cross-party IDOR**: a depositor reads only their own bookings/assays; an NWR is visible to its holder
  or staff (404 otherwise); operator actions verify `warehouse.operator_user_id == caller` (or admin).
- **Platform-global warehouses** (NULL `tenant_id`, independent WDRA) are cross-tenant *visible* (browse +
  bookable) per the 0014 RLS policy, but **never editable** cross-tenant (`getForUpdate` is strictly tenant-owned).
- **Anti-mass-assignment**: zod `.strict()` DTOs; storage fee + NWR holder are server-derived (holder = the
  booking's depositor); one active eNWR per booking; `enwr_no` uniqueness → typed 409.
- **Money safety**: `storage_fee` is zero-sum + idempotent; a free warehouse moves no money; fail-closed when
  no payee. Audit rows on warehouse-list, booking-release, eNWR-issue.
- **AuthZ throws**: `warehouse.manage` (operator), `warehouse.store` (depositor). Tenant_id + RLS everywhere
  (integration proves cross-tenant denial). Keyset pagination with max `LIMIT`.

## Events (outbox, Law 4)
`warehousing.warehouse_listed/updated`, `warehousing.booking_requested/confirmed/stored/released/cancelled`,
`warehousing.assay_recorded`, `warehousing.nwr_issued/released/cancelled`.

## Scope & deferrals
**In scope:** warehouses (incl. platform-global), storage bookings (storage-fee settlement at release), accredited assays, eNWR issuance/release.
**Deferred (schema in 0010, not wired):** NWR **pledge → loan collateral** + partial release + default
(fintech flow), mark-to-market revaluation job, re-assay-due job, auto-valuation from assay grade × mandi
price, multi-unit → quintal conversion (fees assume quintals), NERL/CCRL repository API integration.

## Tests
- `__tests__/warehousing-domain.spec.ts` — booking + NWR state machines, float-free storage fee, months-stored rounding, invariants.
- `__tests__/storage-booking.service.spec.ts` — release storage-fee zero-sum legs; free warehouse moves no money; no-payee fail-closed.
- `__tests__/warehouse.service.spec.ts` — register quota+outbox+audit; operator-only edit.
- `__tests__/tenant-isolation.spec.ts` — SQL contract (tenant_id, own-OR-NULL bookable, strict FOR UPDATE, keyset, one-active-NWR guard).
- `__tests__/warehousing.integration.spec.ts` — real Postgres: warehouse→book→confirm→store→assay→eNWR→**release[storage-fee zero-sum]**→RLS.

> No Postgres in the sandbox, so the live RLS / storage-fee assertions run on the first CI run with a service container.
