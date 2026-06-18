# logistics module (PRD M07 — fulfilment & delivery)

Turns a confirmed order into a physical **shipment** and drives it to the buyer with **OTP-gated
proof-of-delivery**. A confirmed order auto-creates a shipment; ops/riders move it
`pending → assigned → … → out_for_delivery → delivered`; delivery requires the buyer's OTP; on
delivery the order is advanced to `delivered` (opening the quality/dispute window → settlement).
Built to the `listings`/`orders` bar. Gated by the `logistics` feature flag (default OFF).

## What it owns
- **Shipment lifecycle** — `pending → assigned → pickup_scheduled → picked_up → in_transit → at_hub →
  out_for_delivery → delivered`, plus `failed` (re-attemptable) / `returned` / `cancelled`. State
  machine in `domain/shipment.state.ts` (mirrors the `shipment_status` enum). Every status change
  appends an immutable `shipment_events` tracking row.
- **Auto-creation from orders** — `OrderConfirmedHandler` consumes `orders.order_confirmed` and creates
  ONE pending shipment per order (idempotent on `(tenant_id, order_id)` — index in migration 0023).
- **Dispatch & OTP** — `out_for_delivery` generates a 6-digit OTP, stores **only its HMAC hash**
  (server pepper), and hands the raw code to the (deferred) SMS relay via the internal
  `logistics.delivery_otp_issued` outbox event. The hash is the only OTP material at rest.
- **Proof-of-delivery** — `deliver` verifies the submitted OTP's hash in **constant time** (in the
  entity); optional signed POD media id is recorded. On success it emits `logistics.shipment_delivered`.
- **Order bridge** — orders' `ShipmentDeliveredHandler` consumes `logistics.shipment_delivered` and
  advances the order to `delivered` via `Order.recordCarrierDelivery()` (walks only LEGAL state-machine
  edges; idempotent). The order's manual fulfilment chain (picked_up/in_transit/out_for_delivery) is
  carrier-driven — logistics is the source of truth for physical movement.

## Security properties (threats considered)
- **Tenant isolation (Law 1)** — `tenant_id` in every query + RLS; the integration test proves tenant B
  sees zero of tenant A's shipments. Partitioned reads prune via `uuid_v7_time(id)` (Law 8).
- **OTP at rest is hashed** — the delivery code is never stored or returned in plaintext; only its
  HMAC-SHA256 hash (server pepper) lives on the shipment, compared in constant time. A DB dump reveals
  no codes. The raw code travels only in the internal SMS-relay outbox event (consumed + purged by the
  notifications relay; never logged, never in an API response).
- **Authorization that throws** — `create/assign/schedule/cancel` require `logistics.manage`;
  `pickup/in_transit/out_for_delivery/deliver/fail` are manager-OR-the-assigned-rider (a rider can only
  act on shipments where `rider_user_id` = them). Everyone else gets `SHIPMENT_FORBIDDEN`.
- **No money here** — `charge_minor`/`cod_minor` are bigint minor units carried for reference; no funds
  move in this module (COD settlement is a payments concern).
- **Concurrency** — no version column → every mutation locks the row `SELECT … FOR UPDATE`; status
  changes go only through the state machine. Lists are **keyset** (cursor, never OFFSET); all bounded.
- **Idempotency** — `create` is idempotent per `(user, endpoint)` + a one-shipment-per-order guard;
  the order-confirmed handler is idempotent on `existsForOrder`; delivery is single-shot (the entity
  state machine blocks re-delivery). Audit rows on deliver/fail/cancel.

## Endpoints
`POST /v1/shipments` (ops create) · `GET /v1/shipments?box=all|mine[&status=&orderId=]` ·
`GET /v1/shipments/:id` · `POST /v1/shipments/:id/assign` · `…/schedule-pickup` · `…/picked-up` ·
`…/in-transit` · `…/at-hub` · `…/out-for-delivery` · `…/deliver` (OTP) · `…/fail` · `…/cancel`.

## Tests
Unit (`shipment.service.spec.ts`): state machine + aggregate + OTP-gated delivery (match / wrong /
missing, constant-time). `tenant-isolation.spec.ts`: SQL contract (tenant_id everywhere, partition
prune, FOR UPDATE, no version, keyset, tracking events). Integration (`logistics.integration.spec.ts`,
real Postgres + RLS + relay): order_confirmed → auto-shipment (idempotent) → assign/pickup/dispatch
(OTP hashed) → wrong-OTP rejected → correct-OTP delivers → relay → order delivered → cross-tenant RLS.
Orders unit (`carrier-delivery.spec.ts`): `recordCarrierDelivery` legal-edge walk + idempotency.

## Deferred (flagged, not faked) — later logistics-ops wave
- **Delivery partners, vehicles, delivery zones, routes (Saturday Village Run), pickup slots, cold-chain
  logs** — scaffolded under this module but NOT wired here; they are tenant master-data / ops-planning
  features for a dedicated wave.
- **Delivery-OTP SMS dispatch** — the OTP is generated + hashed here and emitted on
  `logistics.delivery_otp_issued`; the actual SMS send lands with the communication/notifications module.
- **COD reconciliation** (cash collected → wallet) lands with the payments COD flow.
