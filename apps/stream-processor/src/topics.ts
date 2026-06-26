// apps/stream-processor/src/topics.ts · topic + partition strategy. PURE (no I/O) so it's unit-tested and
// identical on the producer (tailer) and consumer sides.
//
// Design:
//  • Events are grouped onto a small number of topics by AGGREGATE family (orders/auctions/dairy/…) rather
//    than one topic per event type — fewer topics, stable partitioning, easy consumer subscription. A catch-all
//    'kv.events' carries anything unmapped so nothing is silently dropped.
//  • The PARTITION KEY is always the tenant_id (or '__platform__' for tenant-less events). Same key ⇒ same
//    partition ⇒ per-tenant ORDERING is preserved and one hot tenant can't reorder another's stream.
//  • Output topics (fraud signals, analytics) are produced BY consumers for downstream services; the DLQ topic
//    carries poison messages for the operator/replayer.

export const TOPICS = {
  orders: 'kv.orders',
  auctions: 'kv.auctions',
  dairy: 'kv.dairy',
  catalogue: 'kv.catalogue',      // listings/products → search + projections
  payments: 'kv.payments',
  views: 'kv.views',              // per-impression listing views → counted read-model (P1-15; isolated so the
                                  // high-volume firehose never shares a topic with search/projection/notification)
  events: 'kv.events',            // catch-all for unmapped aggregate families (never drop)
  // outputs produced by consumers
  fraudSignals: 'kv.fraud.signals',
  analytics: 'kv.analytics.events',
  deadLetter: 'kv.dlq',
} as const;
export type TopicName = typeof TOPICS[keyof typeof TOPICS];

export const PLATFORM_KEY = '__platform__';

/** Aggregate family → ingest topic. Derived from the event_type prefix ('orders.order_created' → orders). */
const FAMILY_TOPIC: Record<string, TopicName> = {
  orders: TOPICS.orders,
  auctions: TOPICS.auctions,
  dairy: TOPICS.dairy,
  listings: TOPICS.catalogue,
  catalogue: TOPICS.catalogue,
  products: TOPICS.catalogue,
  payments: TOPICS.payments,
  views: TOPICS.views,            // 'views.listing_viewed' → kv.views (own topic; not catalogue, so it never
                                  // feeds the projection-builder/search-indexer that key off 'listings.*')
};

/** The ingest topic an event_type publishes to. Unknown families go to the catch-all (never dropped). */
export function topicForEvent(eventType: string): TopicName {
  const family = typeof eventType === 'string' ? eventType.split('.')[0] ?? '' : '';
  return FAMILY_TOPIC[family] ?? TOPICS.events;
}

/** The Kafka message key = partition key. Same tenant ⇒ same partition ⇒ preserved per-tenant ordering. */
export function partitionKey(tenantId: string | null | undefined): string {
  return tenantId && tenantId.length > 0 ? tenantId : PLATFORM_KEY;
}

/** The ingest topics the tailer publishes to (every family topic + catch-all). */
export const INGEST_TOPICS: readonly TopicName[] = [
  TOPICS.orders, TOPICS.auctions, TOPICS.dairy, TOPICS.catalogue, TOPICS.payments, TOPICS.views, TOPICS.events,
];

/** A consumer concern: its Kafka consumer group id + the ingest topics it subscribes to. */
export interface ConsumerSubscription { readonly concern: string; readonly groupId: string; readonly topics: readonly TopicName[]; }

/** Which ingest topics each consumer concern subscribes to. Distinct groupIds ⇒ each concern gets the full
 *  stream independently (a slow analytics consumer never blocks search indexing). */
export const CONSUMER_SUBSCRIPTIONS: Record<string, ConsumerSubscription> = {
  search_indexer:      { concern: 'search_indexer',      groupId: 'sp-search-indexer',      topics: [TOPICS.catalogue] },
  notification_fanout: { concern: 'notification_fanout', groupId: 'sp-notification-fanout', topics: [TOPICS.orders, TOPICS.auctions, TOPICS.payments, TOPICS.events] },
  projection_builder:  { concern: 'projection_builder',  groupId: 'sp-projection-builder',  topics: [TOPICS.orders, TOPICS.catalogue, TOPICS.auctions, TOPICS.dairy] },
  fraud_signal:        { concern: 'fraud_signal',        groupId: 'sp-fraud-signal',        topics: [TOPICS.orders, TOPICS.payments, TOPICS.auctions] },
  view_counter:        { concern: 'view_counter',        groupId: 'sp-view-counter',        topics: [TOPICS.views] },
  analytics_etl:       { concern: 'analytics_etl',       groupId: 'sp-analytics-etl',       topics: INGEST_TOPICS },
};
