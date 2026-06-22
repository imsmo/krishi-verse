# disputes module (PRD M-disputes — order disputes & resolution)

When a delivered order goes wrong, a party (buyer or seller) raises a **dispute** against the
counterparty; the two sides exchange **threaded evidence**; a **moderator** reviews, escalates, and
**resolves** (refund / partial refund / replacement / rejected). Opening a dispute **pauses** the order
(so it can't auto-complete/settle); resolving **drives** the order to refunded/released. Built to the
`listings`/`identity` bar. Gated by the `disputes` feature flag (default OFF).

## What it owns
- **Dispute eligibility** — `OrderDeliveredHandler` consumes `orders.order_delivered` and records ONE
  `dispute_eligibility` row per order (the buyer + seller travel in the event — no cross-module read,
  Law 11; migration 0025). Only a party to a delivered order can dispute.
- **Dispute lifecycle** — `open → seller_responded → under_review → escalated → resolved | rejected`,
  plus `withdrawn`. State machine in `domain/dispute.state.ts` (mirrors the `dispute_status` enum).
- **Raise** — `POST /v1/disputes` (`dispute.raise`, Idempotency-Key). The client sends `orderId` + a
  reason **code** (resolved to a `lookup_value` id server-side) + text; the counterparty
  (`against_user`) is resolved from eligibility — never client-supplied (anti-IDOR). One active dispute
  per `(order, raiser)`.
- **Evidence** — `POST/GET /v1/disputes/:id/messages` (threaded, append-only, parties + moderator).
- **Moderation** — `review` / `escalate` / `resolve` need `dispute.resolve`; respond/withdraw are party
  actions. Resolving sets `resolution_type` (+ amount for partial) and emits `disputes.dispute_resolved`.
- **Order integration (events, both ways)** — opening emits `disputes.dispute_opened` → orders'
  `DisputeOpenedHandler` sets the order `disputed` (pausing settlement); resolving emits
  `disputes.dispute_resolved` → orders' `DisputeResolvedHandler` applies it: `refund_full → refunded`,
  `refund_partial → partially_refunded`, `rejected/replacement → completed` (releases escrow to the
  seller via the existing settlement path). Each handler is idempotent and touches only its own module.

## Security properties (threats considered)
- **Tenant isolation (Law 1)** — `tenant_id` in every query + RLS (disputes/messages via the 0014
  auto-pass; `dispute_eligibility` via 0025). The integration test proves tenant B sees zero of tenant
  A's disputes.
- **Eligibility-gated, no IDOR** — only a party to a *delivered* order can dispute; the counterparty is
  derived from eligibility, never trusted from the client; a non-party can't read a dispute (`404`, not
  `403`, so disputes can't be enumerated by id).
- **Authorization that throws** — respond is the respondent only; withdraw is the raiser only;
  review/escalate/resolve require `dispute.resolve`; messages are party-or-moderator only. No god/`*`.
- **Abuse-bounded** — one active dispute per `(order, raiser)` (no dispute spam); messages only while
  active; lists keyset + bounded; idempotent raise per `(user, endpoint)`. Audit rows on raise + every
  moderator action.
- **No money here (Law 2)** — disputes never touch the wallet; resolving only records the decision +
  amount and emits an event. The order-status change (refunded/released) is downstream; the actual
  wallet reversal is a flagged next step (see Deferred). `resolution_amount` is bigint minor units.
- **Concurrency** — no version column → mutations lock the row `SELECT … FOR UPDATE`; status changes go
  only through the state machine.

## Endpoints
`POST /v1/disputes` (raise) · `GET /v1/disputes?box=raised|against|all` · `GET /v1/disputes/:id` ·
`POST /v1/disputes/:id/respond` · `POST /v1/disputes/:id/withdraw` ·
`POST/GET /v1/disputes/:id/messages` · `POST /v1/disputes/:id/review|escalate|resolve`.

## Tests
Unit (`dispute.service.spec.ts`): state machine + aggregate (raise/respond/withdraw/escalate/resolve
guards, refund_partial amount rule, terminal guards) + message validation. `tenant-isolation.spec.ts`:
SQL contract (tenant_id everywhere, FOR UPDATE, no version, ON CONFLICT eligibility, global reason
lookup, active-dispute guard, keyset). Integration (`disputes.integration.spec.ts`, real Postgres + RLS
+ relay): order_delivered → eligibility (idempotent) → buyer raises vs seller → non-party/duplicate
blocked → relay pauses order ('disputed') → evidence + seller response → moderator refund_full → relay →
order 'refunded' → cross-tenant RLS denial. Orders unit (`dispute-resolution.spec.ts`):
`Order.applyDisputeResolution` mapping + idempotency.

## Deferred (flagged, not faked) — later wave
## Money reversal (implemented — escrow → buyer wallet)
Resolving as `refund_full`/`refund_partial` emits `disputes.dispute_resolved`; payments'
`DisputeResolvedHandler` (behind the `dispute_refunds` flag, default OFF) moves the held escrow → the
buyer's wallet via the wallet boundary (Law 2) — a ZERO-SUM, idempotent (`dispute-refund:<disputeId>`)
ledger txn. The handler UNIFIES two cases so escrow always holds the gross before the refund:
(a) **not settled** (the common path — a dispute pauses the order before settlement) escrow already
holds it; (b) **already settled** (dispute raised after completion) it FIRST reverses the recorded
settlement leg-for-leg (seller net + tenant commission + GST/TDS + platform fees → escrow) using the
breakdown stored on `settlement_lines` (migration 0026) — a precise, zero-sum clawback; if the seller
already withdrew their net, the wallet's no-overdraw rule makes it fail loudly → DLQ (manual recovery),
never a silent wrong move (a line already in a paid statement is refused → DLQ). Then `refund_full`
sends the gross to the buyer; `refund_partial` refunds the partial and **re-settles the kept remainder**
to the seller through the commission/tax engine (a fresh `settlement_line`). The reversal emits
`payments.dispute_refunded` → this module stamps `resolution_txn_id`. Proven by
`apps/api/src/modules/payments/__tests__/dispute-refund.integration.spec.ts` (not-settled refund AND
settled clawback, both zero-sum).

## Returns / RMA + SLA jobs (built — API-W3-09)
- **Returns sub-domain** (`domain/{return.entity,return.state}.ts`, `repositories/return.repository.ts`,
  `services/return.service.ts`, `controllers/v1/returns.controller.ts`) — a buyer-initiated return/RMA on a
  delivered order, worked through a state machine: `requested → approved → in_transit → received → refunded`
  (or `rejected` from requested/approved). Only the order's **buyer** may request (eligibility from
  `dispute_eligibility`, anti-IDOR); **seller-or-moderator** approves/rejects/receives; the **buyer**
  ships the goods back; a **moderator** (`dispute.resolve`) issues the refund. Party roles are resolved
  server-side from eligibility — never client-supplied; a non-party gets **404** (no enumeration). One
  ACID tx per write, status via the machine (Law 5), outbox events in the SAME tx (Law 4), audit on
  moderator actions, one active return per order. **NO money moves here** — refunding emits
  `disputes.return_refunded`; orders/payments apply the wallet reversal downstream (mirrors the dispute
  refund path). `POST /v1/returns` (+ `:id/{approve,reject,ship,receive,refund}`), `GET /v1/returns[/:id]`
  (boxes: mine/against/all). Gated by the `disputes` flag.
- **Threaded messages** moved to a dedicated **`DisputeMessageService`** (post/list, party-or-moderator,
  active-only) that `DisputeService` now delegates to.
- **SLA worker jobs** (`jobs/{seller-response-timeout,sla-escalation}.job.ts`, run as kv_relay): a dispute
  still `open` past its `seller_respond_by` is moved to `under_review`; any active dispute past `sla_due_at`
  is `escalated` — each emits an outbox event (notifications fan out). Cross-tenant, bounded
  (`FOR UPDATE SKIP LOCKED`), idempotent by the status guard, the flip + outbox write in ONE tx.
  Tests: `returns.spec.ts` (state machine + aggregate) + `returns.integration.spec.ts` (real Postgres:
  buyer-only request + duplicate guard, per-row party authority, full lifecycle to refunded, both SLA jobs,
  cross-tenant RLS denial).

## Deferred (flagged, not faked) — later wave
- **Withdrawn-seller recovery** — if a paid-out seller has withdrawn before a post-settlement clawback,
  the reversal fails to DLQ for manual recovery (no negative-balance/debt ledger yet).
- **Return → wallet refund** — `disputes.return_refunded` is emitted; the orders/payments consumer that
  applies the actual wallet reversal on a received return lands with the events-and-jobs sweep (W4).
- **AI triage** (`ai_triage` column) lands with the AI wave.
