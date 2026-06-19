# Contract Farming (M22) — buyer↔grower contracts + advances + settlement

A corporate/processor **buyer** contracts FPO/grower farmers to produce a crop at an agreed price, funds
their inputs (advances), and settles them at harvest — recovering the advances. Built to the platform laws.
Gated by the **`contract_farming`** feature flag (default **OFF**).

## The money path (Law 2 — wallet boundary only)
Both moves are buyer `userMain` → grower `userMain`, `txnType 'contract_payment'`, **zero-sum + idempotent**:
1. **input advance** (`POST /contracts/:id/advances`): the buyer funds a grower's seed/inputs
   (`contract-advance:<advanceId>`); recovered at settlement.
2. **grower settlement** (`POST /contracts/:id/settle`): `gross = deliveredQty × fixed price`; outstanding
   advances are **recovered** (oldest first, capped at gross); the **net = gross − recovered** is paid to the
   grower (`contract-settle:<settlementId>`). Net is never negative; a fully-recovered settlement moves no money.

## Money correctness — float-free (Law: never float)
`settlementGrossMinor = deliveredQtyMilli × fixedPriceMinor / 1000` with round-half-up integer division;
quantities are scaled integers (×1000). Advance recovery is exact bigint subtraction. Only the **fixed**
price model is settled in this build (floor/ceiling/formula + quality slabs deferred).

## Lifecycle (Law 5 — `domain/farming-contract.state.ts`)
`draft → proposed → signed → active → fulfilled` (+ terminate from proposed/signed/active). Advances,
milestones, and settlement require the contract to be **active**. No version columns → mutations lock **FOR UPDATE**.

## Endpoints
- Templates: `POST /contract-farming/contracts/templates` (`contract.manage`) · `GET` (own + platform-standard) · `GET /:id`.
- Contracts: `POST /contract-farming/contracts` (idempotent) · `GET` (?box=mine|all) · `GET /:id`
  · `POST /:id/{propose,sign,activate,fulfill,terminate}`.
- Growers: `POST /contracts/:contractId/growers` (enrol, idempotent) · `GET`.
- Milestones: `POST /contracts/:contractId/milestones` (record) · `GET` · `POST /milestones/:id/complete`.
- Money: `POST /contracts/:id/advances` (disburse, idempotent) · `GET /:id/advances` · `POST /:id/settle` (idempotent).

## Threats considered
- **No cross-party IDOR**: every contract/grower/milestone/advance read/write verifies the caller is the
  contract's **buyer** (or admin); non-buyers get 404. Grower belongs-to-contract is checked at settle/disburse.
- **Anti over-payment**: settlement gross is computed server-side from the contract's fixed price (never client
  supplied); advance recovery is capped at gross so net ≥ 0; advances/settlement require an active contract.
- **Anti-mass-assignment**: zod `.strict()` DTOs; grower uniqueness `(contract, farmer, parcel)` → typed 409.
- **Money safety**: `contract_payment` legs are zero-sum + idempotent; no-overdraw means the buyer must hold
  the funds; audit rows on advance-disburse + grower-settle.
- **Platform-standard templates** (NULL tenant) are cross-tenant *readable*, never cross-tenant editable.
- **AuthZ throws**: `contract.manage` (buyer/admin) on all writes; tenant_id + RLS everywhere (integration
  proves cross-tenant denial); keyset pagination with max `LIMIT`.

## Events (outbox, Law 4)
`contract_farming.template_created`, `…contract_created/proposed/signed/activated/fulfilled/terminated`,
`…grower_enrolled`, `…milestone_recorded/completed`, `…advance_disbursed`, `…grower_settled`.

## Scope & deferrals
**In scope:** templates (incl. platform-standard), contracts (lifecycle), grower enrolment, milestones (geo-photo tracking), input-advance disbursement, grower settlement (fixed price + advance recovery).
**Deferred (schema in 0010, not wired):** floor_ceiling / formula pricing + quality premium-discount slabs,
tripartite financier/bank flow, e-sign envelope integration, negotiating/breached/disputed states,
milestone-due reminder job, contract-from-order linkage, land_parcels FK (land-soil-weather module).

## Tests
- `__tests__/contract-farming-domain.spec.ts` — contract state machine, float-free fixed-price gross, advance recovery math, enrolment invariants.
- `__tests__/farming-contract.service.spec.ts` — settleGrower net-of-advance zero-sum legs; full-recovery → no money moved.
- `__tests__/contract-template.service.spec.ts` — template create outbox + authz.
- `__tests__/tenant-isolation.spec.ts` — SQL contract (tenant_id, own-OR-NULL templates, FOR UPDATE, keyset, advance-recovery lock).
- `__tests__/contract-farming.integration.spec.ts` — real Postgres: contract→sign→activate→enrol→advance[money]→**settle[net zero-sum + recovery]**→RLS.

> No Postgres in the sandbox, so the live RLS / advance + settlement assertions run on the first CI run with a service container.
