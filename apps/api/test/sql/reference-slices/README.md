# Reference slices (NOT used by the test suite)

These `*_slice.sql` files are kept **for reference only**. They are self-contained, single-file
schemas that mirror a *subset* of the production tables (with the cross-FKs dropped) for one
module each — the way the integration tests used to bootstrap before we switched them to load the
real migrations.

They are **no longer wired into anything**. The integration tests now build their database from the
REAL `db/migrations/*.sql` + `db/seeds/*.sql` via `apps/api/test/integration-global-setup.js`, with
per-test fixtures from `apps/api/test/helpers/fixtures.ts`. That removes any chance of the test
schema drifting from what production migrations actually create.

Why keep them:
- a quick, readable, one-file overview of the core tables + RLS for a single module;
- a fast local sandbox (`psql -f <slice>.sql`) when you want to poke at one module's tables
  without standing up the whole 250-table platform.

Available slices: `00_listings_slice.sql`, `catalogue_slice.sql`, `identity_slice.sql`,
`orders_slice.sql`, `payments_slice.sql` (payments + wallet/ledger), `auctions_slice.sql`
(auctions + bids + EMD ledger bits), `offers_slice.sql` (listing_offers negotiation + 0020 RLS), `requirements_slice.sql` (reverse marketplace: requirements + requirement_responses), `logistics_slice.sql` (shipments + shipment_events fulfilment), `reviews_slice.sql` (verified-purchase reviews + eligibility), `disputes_slice.sql` (disputes + messages + eligibility), and `02_seed_min.sql`.

Caveats if you ever use them:
- they are a hand-maintained subset — they can fall behind the real migrations;
- they drop foreign keys and simplify columns, so they are NOT a substitute for the migrations;
- `02_seed_min.sql` is the matching minimal plan/quota seed the old listings slice relied on;
- `payments_slice.sql` tenant-scopes `payments` for the demo, but in production the
  `wallet_accounts`/`ledger_*` tables are EXCLUDED from the automatic tenant RLS and run under a
  stricter `kv_wallet` regime — only the wallet service writes them.

The authoritative schema is always `db/migrations/`; the authoritative seed data is `db/seeds/`.
