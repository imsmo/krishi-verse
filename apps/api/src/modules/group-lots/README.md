# group-lots (FPO pooling · P1-12)

A coordinator pools many farmers' produce into one large, sale-ready lot — the PRD §7.7 signature feature.

## Lifecycle (`group_lots.status`, Law 5)
`pledging → ready → listed → sold → settled` (+ `cancelled` from any non-terminal pre-sale state). `ready` may
reopen to `pledging` if short. The state machine lives in `domain/group-lot.state.ts`.

## Routes (`/v1/group-lots`, `group_lots` flag)
- `POST /` — open a lot (product, target qty, unit, pledge deadline, coordination fee bps). `group_lot.coordinate`, idempotent.
- `GET /` — browse (`box=mine|all`, status filter), keyset. Any authenticated tenant user.
- `GET /:id` — lot detail + its pledges (masked to ids/quantities; settled shares once settled).
- `POST /:id/pledges` — record a farmer's pledge (running total; deadline-gated). `group_lot.coordinate`, idempotent.
- `POST /:id/ready` — mark ready for sale. `group_lot.coordinate`.
- `POST /:id/cancel` — cancel the lot. `group_lot.coordinate`.
- `POST /:id/settle` — split the sale proceeds. `group_lot.coordinate`.

## Settlement (float-free, zero-loss — `domain/settle.ts`)
Given the gross sale proceeds (bigint minor) and the lot's coordination fee (bps): `fee = round(gross × bps/10000)`,
`net = gross − fee`, then `net` is split across pledges **in proportion to quantity** (numeric(14,3) → integer
milli-units). Remainder paise from integer division are handed out largest-quantity-first so the shares **sum
exactly to net** (Law 2). Each pledge's `settled_share_minor` is recorded.

> **Money note (Law 2):** settle COMPUTES + RECORDS the proportional breakdown only — it does **not** move money.
> The actual disbursement of each farmer's share to their wallet rides the payments/wallet path and is a
> **deliberate follow-on** (flagged), not built here. Linking a `ready` lot to a sale `listing` is owned by the
> listings module (`listings.group_lot_id`) and is likewise out of this module's scope.

## Security / invariants
tenant_id in every query + RLS (auto-applied by migration 0014 to the 0005 `group_lots` + `group_lot_pledges`
tables — no new migration). One ACID tx per write; audited; outbox events in-tx (Law 4). `group_lot.coordinate`
THROWS (Law 6) — being a coordinator is not self-grant. Quantities + money are integer-scaled (never float).
Pledges are upserted per (lot, farmer) — re-pledging adds to the running quantity.
