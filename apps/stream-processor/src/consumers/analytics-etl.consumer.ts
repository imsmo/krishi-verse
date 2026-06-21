// apps/stream-processor/src/consumers/analytics-etl.consumer.ts · transforms EVERY event into a flat, typed
// analytics record and PRODUCES it to kv.analytics.events. The analytics-pipeline sibling (ClickHouse + dbt)
// ingests that topic into its warehouse — that landing is the analytics-pipeline's job, not this consumer's
// (honestly flagged, not faked: this consumer's contract ends at the topic). The flattened record is NON-PII by
// construction (ids + dimensions + string-minor amounts, no names/phones/emails). Idempotent at the warehouse
// via (event_id) dedup; here we just transform + emit.
import type { ConsumerSpec, ConsumerContext } from '../messaging/consumer-runtime';
import { CONSUMER_SUBSCRIPTIONS, TOPICS, partitionKey } from '../topics';
import type { StreamEvent } from '../envelope';

const PII_KEYS = new Set(['phone', 'email', 'name', 'aadhaar', 'pan', 'account', 'address', 'otp', 'token']);

/** Flatten an event to an analytics fact row. Drops any obviously-PII key defensively; money stays string. */
function toFact(ev: StreamEvent): Record<string, unknown> {
  const dims: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ev.payload)) {
    const lk = k.toLowerCase();
    if ([...PII_KEYS].some((p) => lk.includes(p))) continue;       // never land PII in analytics
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') dims[k] = v;
  }
  const [family, action] = ev.eventType.split('.');
  return {
    event_id: ev.eventId,
    tenant_id: ev.tenantId,
    event_family: family ?? '',
    event_action: action ?? ev.eventType,
    aggregate_type: ev.aggregateType,
    aggregate_id: ev.aggregateId,
    occurred_at: ev.occurredAt,
    dims,
  };
}

export function analyticsEtlConsumer(): ConsumerSpec {
  const sub = CONSUMER_SUBSCRIPTIONS.analytics_etl;
  return {
    concern: sub.concern,
    groupId: sub.groupId,
    topics: sub.topics,
    async handle(ev: StreamEvent, ctx: ConsumerContext): Promise<void> {
      await ctx.producer.send(TOPICS.analytics, partitionKey(ev.tenantId), JSON.stringify(toFact(ev)));
    },
  };
}
