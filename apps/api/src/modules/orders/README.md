# orders module (PRD M04)

The commerce spine: the buyer's **cart**, **checkout** (cart → one order per seller), and the
**order lifecycle** state machine. Built to the `listings`/`identity`/`catalogue` bar. The
**money/payment** step is deliberately NOT here — it is owned by the `payments` + wallet-service
modules and is gated by the `online_payments` feature flag until those land (Law 2, Law 10).

## What it owns (tenant-facing surface)
- **Cart** — add/update/remove/clear items in the buyer's single active cart. Each item is
  validated against the **live listing** (purchasable + in stock) via `ListingService` — the
  listings module's public API, never its repository (Law 11). The cart view recomputes the
  current price and flags drift since the item was added.
- **Checkout** — converts the active cart into **one order per seller** (a `checkout_group` links
  the siblings when multi-seller), in ONE ACID transaction: prices/titles are **snapshotted** into
  the order, the initial status + events are written, quota is enforced, the cart is marked
  converted, and `orders.order_created` (+ `orders.payment_required` when online payment is on) is
  written to the outbox in the SAME tx (Law 4). Idempotent per buyer+key (Law 3).
- **Order lifecycle** — `confirm → packed → ready → … → delivered → completed`, plus `cancel`,
  `dispute`. Every transition: load `FOR UPDATE` (partition-pruned), apply the entity method (which
  enforces the state machine + buyer/seller ownership), optimistic-locked write (`version`),
  timeline event + outbox events in-tx, and an audit row for the actor.

## Security properties (threats considered)
- **Tenant isolation (Law 1)**: every cart/order query binds `tenant_id`; RLS
  (`tenant_id = current_tenant_id()`, `FORCE`) is the net. Proven by the integration test — tenant
  B sees zero of tenant A's orders.
- **Ownership, not just authentication**: only the **seller** can confirm/pack/ready; only the
  **buyer** (or a moderator) can complete; `cancel` checks the caller is the buyer or seller of
  *that* order. Jobs use `systemCancel()` which bypasses ownership but still obeys the state machine.
- **No existence leak (IDOR)**: reading an order you're not a party to returns **404, not 403**
  (`getVisible` filters to buyer/seller/moderator), so an attacker can't probe order ids.
- **State machine is the only authority (Law 5)**: illegal jumps (e.g. `created → delivered`,
  cancelling a dispatched order, completing before delivery) throw `ORDER_ILLEGAL_TRANSITION` /
  `OrderForbiddenError` — there is no code path that mutates `status` directly.
- **Money is bigint minor units (Law 2)**: line totals use `lineTotalMinor` (bigint, floors to the
  paisa); never float. Tax/commission/TDS are 0 at placement and computed at settlement by
  `payments`. The order total can never go negative.
- **Concurrency**: orders are optimistic-locked by `version`; a lost update returns
  `OrderConcurrencyError` (409). Checkout locks the cart + its items `FOR UPDATE`.
- **Scale (Law 8)**: `orders`/`order_items`/`order_events` are RANGE-partitioned by `created_at`
  with a composite PK `(id, created_at)`; **every** point lookup derives the partition window from
  the v7 id via `uuid_v7_time($1)` so Postgres prunes to one partition. Worker finders use
  `FOR UPDATE SKIP LOCKED` and are bounded to recent partitions. Lists are keyset/cursor only.

## Endpoints
`GET /v1/cart` · `POST /v1/cart/items` · `PATCH /v1/cart/items/:listingId` ·
`DELETE /v1/cart/items/:listingId` · `DELETE /v1/cart` ·
`POST /v1/checkout` (idempotency-key) ·
`GET /v1/orders` (cursor; buyer or seller view) · `GET /v1/orders/:id` ·
`POST /v1/orders/:id/confirm|pack|ready|deliver|complete|cancel|dispute` (RBAC `order.manage` for
seller actions; buyer actions scoped to the buyer).

## Jobs (resilience / SLAs)
`seller-confirm-timeout` (auto-cancel orders the seller didn't confirm within the acceptance
window — `systemCancel`), `auto-complete-quality-window` (auto-complete delivered orders after the
dispute window), `abandoned-carts` (mark stale active carts abandoned). All tenant-scoped,
`SKIP LOCKED`, partition-bounded.

## Tests
Unit (`order.service.spec.ts`): state-machine transition table + coverage, `lineTotalMinor` bigint
math, `OrderItem` quantity guard, placement totals (COD vs payment_pending), lifecycle ownership
guards, `systemCancel`, `markPaid` idempotence. `tenant-isolation.spec.ts`: SQL contract — every
read/write binds `tenant_id`, prunes via `uuid_v7_time`, row-locks / `SKIP LOCKED`, optimistic
`version`. Integration (`orders.integration.spec.ts`, real Postgres + RLS): cart → checkout →
order (+ outbox, price snapshot, cart converted), checkout idempotency, lifecycle + ownership,
404-not-403 for strangers, cross-tenant RLS denial. The integration DB is built from the REAL
`db/migrations` + `db/seeds` (via `test/integration-global-setup.js`); the spec inserts only its
own FK-ordered fixtures (`test/helpers/fixtures.ts`).

## Deferred (flagged, not faked)
The money path (`payments` + wallet-service) — orders already start in `payment_pending` and emit
`orders.payment_required` when the `online_payments` flag is on; the `payment-succeeded` handler is
the integration point that will call `order.markPaid()`. Similarly `shipment-delivered` (→
`logistics`) and `dispute-resolved` (→ `disputes`) handlers, the `orders.publisher`, and
`tenant-order-stats` analytics (Phase 2) are scaffolded stubs. The per-item
`cart-item`/`order-item`/`checkout-group` repositories/services/DTOs are intentionally empty:
items are owned by their **aggregate root** (cart/order), so all item SQL lives in
`cart.repository`/`order.repository`.
