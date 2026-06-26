# Per-impression listing views (P1-15)

Real view counts in listing + tenant analytics, fed entirely by the high-volume event pipeline — **no synchronous
hot-path cost** and **never faked**.

## Flow (all off-band)
```
POST /v1/listings/:id/view        (authed, flag `listing_views`, fire-and-forget)
  └─ ListingViewService.record()  → ONE `views.listing_viewed` outbox event {v, listingId}  (NON-PII, no viewer id)
       └─ outbox tailer            → kv.views   (its OWN topic — never touches search/projection consumers)
            └─ stream-processor `view_counter` consumer
                 └─ UPSERT listing_view_counts (tenant_id, listing_id) total_views += 1, last_viewed_at = now()
```
Rendering a listing (`GET :id`) is untouched — counting/aggregation happen entirely in the stream-processor.

## Bounded + deduped
- **Bounded:** `listing_view_counts` (migration 0051) has PK `(tenant_id, listing_id)` — exactly one row per listing
  via UPSERT increment, never a row per impression. Billions of views ⇒ thousands of rows.
- **Deduped:** the consumer runtime's idempotency store (keyed on the outbox event id) skips at-least-once
  redeliveries, so each emit is counted once. A plain `+1` is therefore safe (accumulator, not a snapshot).
- Tenant isolation: RLS on `listing_view_counts`; the consumer writes through `withTenantTx`; analytics reads are
  replica-backed with explicit `tenant_id`.

## Surfaced
- `ListingAnalyticsReadModel` → `views`, `lastViewedAt` (owner-only seller analytics; 0 until first view).
- `TenantAnalyticsReadModel` → `listingViews` (tenant-wide `SUM(total_views)`).
- SDK: `client.listings.recordView(id)` (best-effort), `ListingAnalytics.views/lastViewedAt`,
  `TenantAnalytics.listingViews`.

## Honest scope / degrade
- The view endpoint is authenticated (bounds abuse, gives a clean tenant) and behind `listing_views` (seeded OFF →
  404 when off). An emit failure is swallowed — a dropped impression is acceptable (Law 12), never a 5xx to the user.
- **Deferred (not faked):** per-unique-viewer windowed dedup and anonymous-impression counting are a warehouse
  rollup / WAF-fronted concern (analytics-pipeline), not invented in this counter. The number here is honest
  total accepted views.
