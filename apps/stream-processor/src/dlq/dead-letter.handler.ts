// apps/stream-processor/src/dlq/dead-letter.handler.ts · where poison messages go to die (visibly). When a
// consumer exhausts retries or hits a permanent (bad-data) error, the message is recorded in stream_dead_letters
// (operator-inspectable, replayable) AND mirrored to the kv.dlq topic (for external alerting). Append-only,
// one row per (consumer,event_id) — bounded write amplification. NEVER throws (a failing DLQ must not wedge the
// partition; we'd rather log-and-continue than block all of a tenant's later events behind one poison message).
import type { Db } from '../db';
import type { StreamProducer } from '../messaging/producer';
import type { StreamMetrics } from '../metrics';
import type { StreamEvent } from '../envelope';
import { TOPICS } from '../topics';
import { partitionKey } from '../topics';

export class DeadLetterHandler {
  constructor(private readonly db: Db, private readonly producer: StreamProducer, private readonly metrics: StreamMetrics) {}

  async deadLetter(consumer: string, ev: StreamEvent, reason: string, errorMessage: string, attempts: number): Promise<void> {
    this.metrics.deadLettered(consumer, reason);
    try {
      await this.db.query(
        `INSERT INTO stream_dead_letters (tenant_id, consumer, event_id, event_type, payload, error_code, error_message, attempts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (consumer, event_id) DO NOTHING`,
        [ev.tenantId, consumer, ev.eventId, ev.eventType, JSON.stringify(ev.payload), reason, errorMessage.slice(0, 1000), attempts],
      );
    } catch { /* DLQ persistence is best-effort; never wedge the consumer */ }
    try {
      await this.producer.send(TOPICS.deadLetter, partitionKey(ev.tenantId), JSON.stringify({ consumer, reason, attempts, event: ev }));
    } catch { /* alerting mirror is best-effort */ }
  }
}
