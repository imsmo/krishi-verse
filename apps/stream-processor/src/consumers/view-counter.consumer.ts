// apps/stream-processor/src/consumers/view-counter.consumer.ts · the COUNTED read-model builder for per-impression
// listing views (P1-15). Subscribes to kv.views (its OWN topic — the firehose never shares a partition set with
// search-indexer/projection-builder), and for each `views.listing_viewed` event UPSERT-increments exactly one row
// in listing_view_counts. The HOT PATH (rendering a listing) is untouched: views are emitted off-band by the
// API's throttled `POST /v1/listings/:id/view` → outbox → tailer → here.
//
// IDEMPOTENT / DEDUPED: the consumer runtime already calls idempotency.alreadyProcessed(concern, eventId) BEFORE
// handle() and skips redeliveries — at-least-once delivery can re-send the same outbox event after a crash, and it
// is counted ONCE. So a plain `+1` here is safe (no monotonic guard needed: this is an accumulator, not a snapshot).
// BOUNDED: one row per (tenant, listing) via the PK upsert — never a row per impression.
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
      await ctx.db.withTenantTx(ev.tenantId, async (c) => {
        await c.query(INCREMENT_SQL, [ev.tenantId, listingId]);
      });
    },
  };
}
