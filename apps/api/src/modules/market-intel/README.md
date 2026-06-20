# market-intel (PRD §16.2) — Mandi Pulse

Market price intelligence: a mandi registry, a price-observation log, deterministic fair-price bands, and
per-farmer price alerts. Money-free (prices are bigint **observation data**, never wallet movements). Gated by
the `market_intel` feature flag (default **OFF**).

## What it owns

- **Mandis** (`mandis`, GLOBAL reference) — the physical-market registry (Agmarknet code, region, geo).
  Read-only browse here; authoring is admin-api (Law 11). Seeded with a few sample markets.
- **Mandi prices** (`mandi_prices`, GLOBAL, PARTITIONED by `price_date`) — append-only observations from
  Agmarknet / eNAM / platform transactions / ambassador-manual entry. `modal_minor` is bigint minor units /
  quintal, with `min ≤ modal ≤ max` enforced.
- **Price predictions** (`price_predictions`, GLOBAL, PARTITIONED by `created_at`) — fair-price bands
  P10/P50/P90. The **baseline model** derives them from recent modal observations via nearest-rank percentiles
  (float-free, deterministic, `model_version = baseline-v1`); an external ML model can supersede with its own band.
- **Price alerts** (`price_alerts`, TENANT-scoped, user-owned) — a farmer subscribes to a `above`/`below`
  threshold on a product (+region). RLS-protected.

## Flows

- **Ingest** (`market.manage`, Idempotency-Key) appends a price observation, then **evaluates the tenant's
  active alerts** for that product+region and emits a `PriceAlertTriggered` event per crossing — the
  notification spine turns those into farmer alerts. All in one ACID tx, outbox in-tx (Law 4).
- **Mandi Pulse** (`GET /v1/market/pulse`) — a composite read (latest price + latest band + recent history),
  all from the replica (CQRS, Law 12).
- **Predictions** — `market.manage` generates a baseline band from a bounded recent window; any user reads the
  latest band.
- **Alerts** — any authenticated farmer creates/lists/toggles their **own** alerts.

## Threats considered (§4)

- **Tenant isolation / RLS** — `price_alerts` is RLS-protected and bound by `tenant_id` (+ `user_id` for the
  owner). The global market tables (mandis/prices/predictions) carry no tenant data.
- **No IDOR** — alerts are owner-scoped; a non-owner toggle returns **404**. Ingest/predict are `market.manage`-only.
- **No privilege escalation** — ingestion + prediction require `market.manage`; mandis aren't writable here.
- **Money correctness** — bigint minor units only; observation bounds (`min ≤ modal ≤ max`) and band ordering
  (`p10 ≤ p50 ≤ p90`) enforced; percentiles computed on bigint (no float drift).
- **Scale** — price/prediction reads bound `product_id` so PG prunes partitions (Law 8); keyset pagination
  (never OFFSET); ingest fires a bounded set of alerts (`FOR UPDATE SKIP LOCKED`, capped) — no write amplification.

## Deferred (schema present, not built)

Agmarknet/eNAM external ingest jobs (need the external feed API); `platform_txn` price aggregation from
completed orders; an external ML prediction model (the baseline percentile band is wired); search synonyms (a
catalogue/search concern, not market-intel — its scaffolds were removed from this module).

## Tests

`__tests__/market-intel-domain.spec.ts` (observation bounds, baseline band percentiles, alert crossing),
`price.service.spec.ts` (ingest authz + selective alert firing, prediction baseline, alert 404 IDOR),
`tenant-isolation.spec.ts` (CI gate: alert tenant/user binding + FOR UPDATE SKIP LOCKED, global-table partition
prune + keyset), `market-intel.integration.spec.ts` (real Postgres: ingest → pulse → baseline band → alert
fires on crossing → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
