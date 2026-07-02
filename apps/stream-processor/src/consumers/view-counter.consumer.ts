// apps/stream-processor/src/consumers/view-counter.consumer.ts · the COUNTED read-model builder for per-impression
// listing views (P1-15). Subscribes to kv.views (its OWN topic — the firehose never shares a partition set with
// search-indexer/projection-builder), and for each `views.listing_viewed` event UPSERT-increments TWO bounded
// read-models in ONE tenant tx: the all-time total (listing_view_counts, 0051) and the per-day bucket
// (listing_view_daily, 0054 — powers the "Views by day" chart on screen 115). The HOT PATH (rendering a listing)
// is untouched: views are emitted off-band by the API's throttled `POST /v1/listings/:id/view` → outbox → tailer.
//
// IDEMPOTENT / DEDUPED: the consumer runtime already calls idempotency.alreadyProcessed(concern, eventId) BEFORE
// handle() and skips redeliveries — at-least-once delivery can re-send the same outbox event after a crash, and it
// is counted ONCE for BOTH counters (they share this single handle() call). So a plain `+1` is safe (accumulators,
// not snapshots). BOUNDED: total = one row per (tenant, listing); daily = one row per (tenant, listing, day).
// Tenant-scoped writes go through withTenantTx so RLS holds (defense-in-depth on the bypass role).
import type { ConsumerSpec, ConsumerContext } from '../messaging/consumer-runtime';
import { CONSUMER_SUBSCRIPTIONS } from '../topics';
import type { StreamEvent } from '../envelope';

export const LISTING_VIEWED = 'views.listing_viewed';

// Increment the per-(tenant,listing) counter; create the row on first view. `last_viewed_at = now()` is the
// consumer's wall-clock (good enough for "recently viewed"; the event's occurredAt stays in the warehouse via ETL).
const INCREMENT_SQL = `INSERT INTO listing_view_counts (tenant_id, listing_id, total_views, last_viewed_at)
     VALUES ($1, $2, 1, now())
   ON CONFLICT (tenant_id, listing_id) DO UPDATE
     SET total_views = listing_view_counts.total_views + 1, last_viewed_at = now(), updated_at = now()`;

// Per-day bucket: the day key is the event's OCCURRED-AT date in UTC (so a late-delivered event lands in its real
// day, not the processing day). $3 is the event's occurredAt ISO string.
const INCREMENT_DAILY_SQL = `INSERT INTO listing_view_daily (tenant_id, listing_id, day, views)
     VALUES ($1, $2, (($3::timestamptz) AT TIME ZONE 'UTC')::date, 1)
   ON CONFLICT (tenant_id, listing_id, day) DO UPDATE
     SET views = listing_view_daily.views + 1, updated_at = now()`;

/** Pull the listing id from the event: prefer the aggregateId (the listing), fall back to payload.listingId. */
function listingIdOf(ev: StreamEvent): string | null {
  if (ev.aggregateId && ev.aggregateId.length > 0) return ev.aggregateId;
  const p = ev.payload;
  return typeof p.listingId === 'string' && p.listingId.length > 0 ? p.listingId : null;
}

export function viewCounterConsumer(): ConsumerSpec {
  const sub = CONSUMER_SUBSCRIPTIONS.view_counter;
  return {
    concern: sub.concern,
    groupId: sub.groupId,
    topics: sub.topics,
    async handle(ev: StreamEvent, ctx: ConsumerContext): Promise<void> {
      if (ev.eventType !== LISTING_VIEWED) return;     // kv.views only carries views today; ignore anything else
      if (!ev.tenantId) return;                        // view counts are tenant-scoped (RLS); platform views n/a
      const listingId = listingIdOf(ev);
      if (!listingId) return;                          // malformed — nothing to count (never crash)
      // Fall back to the consumer wall-clock only if the envelope somehow lacks occurredAt (never crash the day key).
      const occurredAt = ev.occurredAt && ev.occurredAt.length > 0 ? ev.occurredAt : new Date().toISOString();
      await ctx.db.withTenantTx(ev.tenantId, async (c) => {
        await c.query(INCREMENT_SQL, [ev.tenantId, listingId]);                 // all-time total (0051)
        await c.query(INCREMENT_DAILY_SQL, [ev.tenantId, listingId, occurredAt]); // per-day bucket (0054)
      });
    },
  };
}
