// apps/stream-processor/src/consumers/projection-builder.consumer.ts · CQRS read-model builder. Materialises
// denormalised summaries (order/auction/listing) into stream_read_projections off the event stream, so list/
// dashboard reads hit a purpose-built row instead of joining the write tables. UPSERT by (projection,tenant_id,
// entity_id) with a source_event_id monotonic guard: an out-of-order/redelivered OLDER event never regresses a
// newer row. Tenant-scoped writes go through withTenantTx so RLS holds (defense-in-depth on the bypass role).
import type { ConsumerSpec, ConsumerContext } from '../messaging/consumer-runtime';
import { CONSUMER_SUBSCRIPTIONS } from '../topics';
import type { StreamEvent } from '../envelope';

interface Projection { name: string; entityId: string; doc: Record<string, unknown>; }

/** Decide which projection (if any) an event updates + the denormalised doc. NON-PII, money as string. */
function projectionFor(ev: StreamEvent): Projection | null {
  const p = ev.payload;
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  if (ev.eventType.startsWith('orders.')) {
    return { name: 'order_summary', entityId: ev.aggregateId, doc: { orderId: ev.aggregateId, status: s('status') ?? ev.eventType.replace('orders.order_', ''), buyerUserId: s('buyerUserId'), sellerUserId: s('sellerUserId'), totalMinor: s('totalMinor'), updatedAt: ev.occurredAt } };
  }
  if (ev.eventType.startsWith('auctions.')) {
    return { name: 'auction_summary', entityId: ev.aggregateId, doc: { auctionId: ev.aggregateId, status: s('status'), currentPriceMinor: s('amountMinor') === 'sealed' ? undefined : s('amountMinor'), endsAt: s('endsAt'), updatedAt: ev.occurredAt } };
  }
  if (ev.eventType.startsWith('listings.')) {
    return { name: 'listing_card', entityId: ev.aggregateId, doc: { listingId: ev.aggregateId, title: s('title'), priceMinor: s('priceMinor'), status: s('status'), updatedAt: ev.occurredAt } };
  }
  return null;
}

// UPSERT with a monotonic guard: only overwrite when the incoming event is newer than the one last applied,
// so a redelivered/out-of-order older event can't regress the row.
const UPSERT_SQL = `INSERT INTO stream_read_projections (tenant_id, projection, entity_id, doc, source_event_id)
     VALUES ($1,$2,$3,$4,$5)
   ON CONFLICT (projection, tenant_id, entity_id) DO UPDATE
     SET doc = EXCLUDED.doc, source_event_id = EXCLUDED.source_event_id, updated_at = now()
     WHERE stream_read_projections.source_event_id < EXCLUDED.source_event_id`;

export function projectionBuilderConsumer(): ConsumerSpec {
  const sub = CONSUMER_SUBSCRIPTIONS.projection_builder;
  return {
    concern: sub.concern,
    groupId: sub.groupId,
    topics: sub.topics,
    async handle(ev: StreamEvent, ctx: ConsumerContext): Promise<void> {
      if (!ev.tenantId) return;                                      // projections are tenant-scoped
      const proj = projectionFor(ev);
      if (!proj) return;
      await ctx.db.withTenantTx(ev.tenantId, async (c) => {
        await c.query(UPSERT_SQL, [ev.tenantId, proj.name, proj.entityId, JSON.stringify(proj.doc), ev.eventId]);
      });
    },
  };
}
