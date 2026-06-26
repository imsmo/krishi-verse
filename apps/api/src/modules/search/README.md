# Unified cross-entity search (`search`) — P1-14

One `GET /v1/search` that returns a single **ranked** result list across entity types (listings, products, …),
**tenant-isolated**, with a **Postgres fallback** when OpenSearch is down. Replaces the old honest client-side
fan-out (mobile/storefront).

## Route
- `GET /v1/search?q=&types=&cursor=&limit=` — authenticated, behind the `unified_search` flag (seeded OFF).
  `q` required; `types` is a csv subset (default all); `limit` 1..50. Returns `{ data: SearchHit[], meta: { engine,
  nextCursor } }` where `engine ∈ opensearch | postgres` (so a degrade is observable) and `nextCursor` is an
  opaque **federated** cursor.

## How it ranks + paginates
The query fans across the requested per-entity OpenSearch indices (one `SEARCH_CLIENT.query` per index), then
`domain/search.rank.ts` (pure, unit-tested) merges into one list ordered by **text-match strength** (exact >
prefix > substring) then **recency**, capped to `limit`. There is no single global keyset across heterogeneous
indices, so the cursor is a **per-type map** (`encodeSearchCursor`/`decodeSearchCursor`) — "load more" re-queries
each index from its own `search_after`. Honest federation, not a fake global sort.

## Tenant isolation (attackers test this first)
OpenSearch has no RLS, so `core/search/opensearch.client` injects a **mandatory** `tenant_id` term filter on every
query (caller's tenant + the `__platform__` sentinel for platform-master docs) — a query can never return another
tenant's documents (`SEARCH_TENANT_REQUIRED` fails closed). The Postgres fallback re-asserts isolation with an
explicit `tenant_id = $1` (and `tenant_id IS NULL` only for platform-master products) under the replica's RLS.

## Degrade (Law 12)
When `OPENSEARCH_URL` is unset the core binds `NullSearchClient` (throws `SEARCH_ENGINE_UNAVAILABLE`); when the
cluster is down the transport's breaker trips. Either way `SearchService` catches and runs the
`SearchFallbackReadModel` — a parameterised, keyset, tenant-scoped replica query per type (free text is a bounded
`title ILIKE '%' || $q || '%'` — value param, no injection, ReDoS-safe) — and tags the response `engine: postgres`.
A metric tags every call with the engine used.

## Coverage / scope
Indexed/queried types today: **listings**, **products** (extend by adding an `IndexDef` in
`core/search/indices` + a branch in the fallback read-model — the ranker/cursor are generic). No new migration
(reads the existing `listings`/`products` tables + the existing OpenSearch index plane). **Deferred:** richer
relevance (synonyms/geo/boosts) on the engine path, and adding requirements/courses indices.

## Clients
SDK `search.query()` → `{ items, engine, nextCursor }`. Mobile `globalSearch` now prefers the unified endpoint and
**degrades to the legacy fan-out** when it's disabled/unreachable (`features/system/system.api.ts` +
`fromUnifiedSearch`). Both default behind the flag — never a fabricated result.
