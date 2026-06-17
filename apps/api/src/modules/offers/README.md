# offers module (PRD M03 — listing negotiation)

Buyer↔seller **price negotiation** on a published listing: a buyer makes an offer, the seller
counters or accepts, the buyer accepts or re-counters, and an accepted offer becomes a **deal** that
the orders module turns into an order downstream. Built to the `listings`/`auctions` bar. Gated by
the `offers` feature flag (default OFF).

## What it owns
- **The negotiation lifecycle** — `open → countered* → accepted → converted`, plus the terminal
  `rejected` / `expired`. `round` starts at 1 (the buyer's initial offer); an **odd** round means the
  buyer acted last (⇒ the **seller's** turn), an **even** round means the seller countered last (⇒ the
  **buyer's** turn). The price on the table is the buyer's `offered_price` on the seller's turn and the
  seller's `counter_price` on the buyer's turn. A buyer re-counter replaces `offered_price` and clears
  the stale seller counter. Either party may reject/withdraw at any live moment.
- **Make** — `POST /v1/offers` (`offer.create`, Idempotency-Key). Validates the listing is published,
  the buyer is **not** the seller (no self-deal), and the quantity is within `[min_order_qty,
  quantity_available]`. Offers expire after 72h unless `expiresAt` is given.
- **Respond** — `POST /v1/offers/:id/counter|accept|reject`. The acting party is resolved server-side
  (the buyer is `buyer_user_id`; the seller is the listing's seller, via **ListingService** — Law 11,
  never the listings repo). Turn + state are enforced by the aggregate.
- **Accept = a deal, not money** — accepting emits `offers.offer_accepted` (agreed per-unit price +
  quantity) via the **outbox** in the same tx. Order creation + payment happen **downstream** (orders);
  the order links back by calling `markConverted` (`converted_order_id`, status → `converted`).
- **Expiry** — the `expire-offers` worker job lapses `open|countered` offers past `expires_at`
  (kv_relay pool, `FOR UPDATE SKIP LOCKED`, bounded, idempotent).

## Security properties (threats considered)
- **Tenant isolation (Law 1)** — `tenant_id` in every query + RLS. `listing_offers` was added in
  migration 0015, *after* the 0014 auto-RLS pass, so it had no policy; **migration 0020** backfills the
  tenant policy (the integration test proves tenant B sees zero of tenant A's offers).
- **No self-deal** — a buyer cannot offer on their own listing (`SELLER_CANNOT_OFFER`); the seller
  identity is resolved from the listing, never trusted from the client.
- **Authorization that throws** — `counter/accept/reject` resolve the actor to buyer/seller/moderator
  or throw `OFFER_FORBIDDEN`; out-of-turn actions throw `OFFER_NOT_YOUR_TURN`; a stranger cannot even
  *read* an offer (IDOR-proof — proven by the integration test).
- **No money here** — a negotiation moves no funds; the wallet is untouched until orders creates the
  order. This keeps the money boundary (Law 2) entirely in payments/wallet.
- **Concurrency** — `listing_offers` has **no version column** (add_std_columns), so every mutation
  locks the row `SELECT … FOR UPDATE` inside the tx (the negotiation is low-contention; the row lock
  serializes concurrent counter/accept/reject). Lists are **keyset** (cursor, never OFFSET).
- **Idempotency** — `make` is idempotent per `(user, offers.make)`; lifecycle actions are guarded by
  the FOR UPDATE lock + state machine (a duplicate request conflicts rather than double-applies).

## Endpoints
`POST /v1/offers` (make) · `GET /v1/offers?box=outgoing|incoming[&listingId=…]` (list) ·
`GET /v1/offers/:id` · `POST /v1/offers/:id/counter` · `POST /v1/offers/:id/accept` ·
`POST /v1/offers/:id/reject`.

## Tests
Unit (`listing-offer.service.spec.ts`): state machine + aggregate (make guards, turn model, counter
ping-pong, accept price per party, reject/expire/convert). `tenant-isolation.spec.ts`: SQL contract
(tenant_id everywhere, FOR UPDATE, no version clause, keyset, SKIP LOCKED). Integration
(`offers.integration.spec.ts`, real Postgres + RLS): make → counter → accept (offer_accepted in the
outbox) → self-deal blocked → IDOR blocked → expiry job → cross-tenant RLS denial.

## Deferred (flagged, not faked) — next wave
- **Order creation from an accepted offer** — emitted as `offers.offer_accepted`; the orders-side
  handler (create the buyer's order at the agreed price × quantity, source='offer', then call
  `markConverted`) is the integration point.
- **AI price suggestion** — the `ai_suggested` jsonb column is reserved for an AI service to attach a
  fair-price band; not populated here.
- **Per-offer notifications/watchers** and a buyer↔seller negotiation thread (chat) — communication wave.
