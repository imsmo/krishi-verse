// apps/stream-processor/src/consumers/search-indexer.consumer.ts · keeps the OpenSearch listing/product indices
// in sync off the catalogue stream (the scale-out version of apps/api's in-process search-index handlers —
// moving the projection off the write path). Idempotent: upsert/delete BY ID, so a redelivered event is a safe
// no-op. NON-PII: only the card fields are indexed. Degrades to no-op when OpenSearch isn't configured.
import type { ConsumerSpec, ConsumerContext } from '../messaging/consumer-runtime';
import type { OpenSearchWriter } from '../downstream/opensearch.writer';
import { CONSUMER_SUBSCRIPTIONS } from '../topics';
import type { StreamEvent } from '../envelope';

const REMOVE_EVENTS = new Set(['listings.listing_unpublished', 'listings.listing_deleted', 'listings.listing_archived']);

/** Project a catalogue event payload to a NON-PII search doc (card fields only; money stays a string). */
function toListingDoc(ev: StreamEvent): Record<string, unknown> {
  const p = ev.payload;
  return {
    tenant_id: ev.tenantId,                       // MUST be present so the api's tenant-safe query can filter
    listing_id: ev.aggregateId,
    title: typeof p.title === 'string' ? p.title : undefined,
    crop_id: typeof p.cropId === 'string' ? p.cropId : undefined,
    price_minor: typeof p.priceMinor === 'string' ? p.priceMinor : undefined,   // string (Law 2)
    unit: typeof p.unit === 'string' ? p.unit : undefined,
    region_id: typeof p.regionId === 'string' ? p.regionId : undefined,
    status: typeof p.status === 'string' ? p.status : undefined,
    updated_at: ev.occurredAt,
  };
}

export function searchIndexerConsumer(writer: OpenSearchWriter): ConsumerSpec {
  const sub = CONSUMER_SUBSCRIPTIONS.search_indexer;
  return {
    concern: sub.concern,
    groupId: sub.groupId,
    topics: sub.topics,
    async handle(ev: StreamEvent, _ctx: ConsumerContext): Promise<void> {
      if (!writer.enabled) return;                                   // degrade: replica-backed search in apps/api
      if (!ev.eventType.startsWith('listings.') && !ev.eventType.startsWith('products.') && !ev.eventType.startsWith('catalogue.')) return;
      if (REMOVE_EVENTS.has(ev.eventType)) { await writer.remove('listings', ev.aggregateId); return; }
      await writer.upsert('listings', ev.aggregateId, toListingDoc(ev));
    },
  };
}
