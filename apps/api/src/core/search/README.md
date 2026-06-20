# core/search — OpenSearch index-builders (CQRS search projection)

The platform's full-text / relevance / faceted search. Postgres stays the **system of record**; OpenSearch is a
**derived read projection** built event-driven off the outbox (Law 12 CQRS — search reads never touch the write
primary). Config-driven and flag-gated: with no `OPENSEARCH_URL` the platform falls back to the replica-backed
read-models (same `SEARCH_CLIENT` token, no caller changes).

## Pieces

- **`opensearch.transport.ts`** — the only thing that talks to the cluster. Every call is wrapped in
  `core/resilience` under the `opensearch` dependency (timeout + retry + circuit-breaker + bulkhead) so a slow or
  dead cluster sheds load and never cascades into the write path. Self-contained over `fetch` (no SDK).
- **`opensearch.client.ts`** — the OpenSearch-backed `SearchClient`. **Security invariant:** OpenSearch has no
  RLS, so the client ALWAYS injects a non-negotiable tenant filter `tenant_id IN [caller, __platform__]` — a
  tenant sees only its own + platform/global reference docs, never another tenant's. Keyset pagination via
  `search_after` (never `from`/OFFSET). Free text is a `multi_match` over the index's declared text fields.
- **`indices/*.index.ts` + `index-registry.ts`** — one `IndexDef` per searchable entity (currently `listings`,
  `products`): the OpenSearch mapping/analyzers, the projector (row → doc, `tenant_id` always set;
  `PLATFORM_TENANT` sentinel for global rows), an `isIndexable` predicate, and the outbox event types that wake
  a re-sync. Adding a searchable entity = add an `IndexDef`; the builder/handler/reindexer are generic over it.
- **`index-builder.service.ts`** — `ensureIndices()` creates indices at boot (best-effort; a down cluster never
  blocks API startup). `syncById()` re-reads the current source row and **upserts (if indexable) or deletes** —
  so the index is eventually consistent with Postgres regardless of which event fired.
- **`handlers/search-index.handler.ts`** — the outbox→index projection handler (one per indexed event type). The
  relay delivers an event inside its per-event tx; the handler re-reads the aggregate (relay runs on the
  BYPASSRLS `kv_relay` pool) and indexes-or-drops. Idempotent (upsert/delete by id) under at-least-once delivery.
  Gated by the **`search_indexing`** flag (default OFF — runtime kill switch, Law 10).
- **`jobs/reindex.job.ts`** — `runReindex()`: bounded, keyset-paginated bulk backfill / disaster-recovery
  reindex (each run caps at `maxDocs`, batches of `batchSize`); idempotent (bulk by id). Runs in apps/worker.

## Money & scale

`price_minor` is stored and returned as a **string** (bigint minor units — never a JS float, Law 2); a separate
`price_sort` long exists only for ordering. Every query is bounded (`size ≤ 100`), keyset-only, and tenant-
filtered; the backfill is bounded + batched.

## Threats considered (§4)

- **Tenant isolation** — the mandatory `tenant_id` term filter is applied by the client on EVERY query and an
  untenanted query fails closed (`SEARCH_TENANT_REQUIRED`); proven against a real cluster in the integration
  test (tenant A never sees tenant B's docs).
- **Degrade-never-die** — all cluster I/O is resilience-wrapped; index creation is best-effort at boot; with no
  cluster configured the system transparently uses the replica path.
- **No write amplification / DoS** — sizes capped; reindex bounded + batched; the projection is idempotent.
- **No PII leak** — projectors emit only the browse-card fields already exposed by the read APIs; no secrets.

## Tests

`__tests__/search-index.spec.ts` (tenant-filter invariant + fail-closed, keyset cursor, projectors incl. money-
as-string + platform sentinel, `isIndexable`, builder upsert-or-drop, flag-gated handler, event routing);
`__tests__/search-index.integration.spec.ts` (real OpenSearch: tenant A sees own + platform, never tenant B —
runs when `OPENSEARCH_URL` is set).
