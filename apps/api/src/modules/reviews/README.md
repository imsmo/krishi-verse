# reviews module (PRD M03 — verified-purchase ratings)

Two-sided marketplace ratings: after an order **completes**, the buyer can review the **seller** and
the seller can review the **buyer** — and ONLY those parties, ONLY for that order. Reviews carry stars
(1–5) + dynamic sub-ratings, the reviewed party can respond, moderators can hide/remove, and a cached
aggregate (avg/count/histogram) powers profile pages. Built to the `listings`/`identity` bar. Gated by
the `reviews` feature flag (default OFF).

## What it owns
- **Verified-purchase eligibility** — `OrderCompletedHandler` consumes `orders.order_completed` and
  records ONE `review_eligibility` row per order (the buyer + seller travel in the event — no
  cross-module read, Law 11; migration 0024). This is the gate: no completed order ⇒ no review.
- **Review lifecycle** — `published → (under_moderation | hidden) → removed`. State machine in
  `domain/review.state.ts` (mirrors the `reviews.status` values). A verified review starts `published`.
- **Submit** — `POST /v1/reviews` (`review.create`, Idempotency-Key). The client sends only `orderId`
  + stars/body; the **target is resolved server-side** from the eligibility (buyer→seller or
  seller→buyer) — the client never supplies `target_id` (anti-IDOR). One review per
  `(order, reviewer, target)` (DB UNIQUE).
- **Edit / respond / moderate** — author edits their own; the reviewed party responds once; a moderator
  (`review.moderate`) hides/restores/flags/removes (audited).
- **Aggregate** — `GET /v1/reviews/summary` returns avg + count + star histogram for a target, computed
  from PUBLISHED reviews and **cached** (invalidated on submit/edit/moderate). No per-review write
  amplification onto a counter.

## Security properties (threats considered)
- **Tenant isolation (Law 1)** — `tenant_id` in every query + RLS (reviews predates 0014's auto-pass;
  `review_eligibility` gets its policy in 0024). The integration test proves tenant B sees zero of
  tenant A's reviews.
- **Verified-purchase only (anti-spam/anti-brigading)** — a review requires an eligibility row AND the
  reviewer must be that order's buyer or seller; a non-party gets `REVIEW_NOT_ELIGIBLE`. This makes
  fake-review farms and competitor brigading impossible without a real, completed transaction.
- **No IDOR** — the target is derived from the eligibility, never trusted from the client; one review
  per order per reviewer (UNIQUE); a non-published review is `404` (not `403`) to non-parties so reviews
  can't be enumerated by id.
- **Authorization that throws** — edit is author-only; respond is the reviewed party (or moderator);
  moderation requires `review.moderate`. No platform/god escalation.
- **No money here**; stars are bounded integers; body/tags/sub-ratings are length-and-shape validated
  (zod `.strict()` + domain guards — no ReDoS, no mass-assignment).
- **Concurrency** — no version column → mutations lock the row `SELECT … FOR UPDATE`; status changes go
  only through the state machine. Lists are **keyset** (cursor, never OFFSET); all bounded.
- **Idempotency** — submit is idempotent per `(user, endpoint)` + the `(order,reviewer,target)` UNIQUE;
  eligibility insert is idempotent per order. Audit rows on moderation.

## Endpoints
`POST /v1/reviews` (submit) · `GET /v1/reviews/summary?targetType=&targetId=` (cached aggregate) ·
`GET /v1/reviews?box=target|mine` · `GET /v1/reviews/:id` · `PATCH /v1/reviews/:id` (author edit) ·
`POST /v1/reviews/:id/respond` (reviewed party) · `POST /v1/reviews/:id/moderate`.

## Tests
Unit (`review.service.spec.ts`): state machine + aggregate (submit validation, edit, response,
moderation walk). `tenant-isolation.spec.ts`: SQL contract (tenant_id everywhere, FOR UPDATE, no
version, published-only public read, keyset, ON CONFLICT). Integration (`reviews.integration.spec.ts`,
real Postgres + RLS + relay): order_completed → eligibility (idempotent) → buyer↔seller reviews →
non-party blocked → duplicate blocked → cached summary → moderator hide drops the summary →
cross-tenant RLS denial.

## Deferred (flagged, not faked) — later wave
- **"Helpful" voting** on a review needs a per-user vote table (dedup) — deferred (it would otherwise be
  unbounded write amplification); `helpful_count` stays 0 until then.
- **Booking/course/worker reviews** — `events/handlers/booking-completed.handler.ts` is a documented stub;
  it lands when the labour/education modules emit their completion events (same eligibility pattern).
- **Review prompts** (`jobs/review-prompts.job.ts`) need the notifications module.
- **AI toxicity pre-moderation** — new reviews could route to `under_moderation` via an AI score; the
  status + moderation flow already support it.
