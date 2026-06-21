// apps/stream-processor/src/processing/idempotency.ts · the at-least-once safety net. Kafka delivers a message
// AT LEAST once, so a consumer may see the same event twice (rebalance, retry, replay). Before doing a side
// effect we check stream_processed_events; after a successful side effect we record (consumer, event_id). The
// side effects themselves are also idempotent (search upsert-by-id, notifier dedups on idempotency-key,
// projection upsert) so even a crash between effect and record is safe — redelivery just repeats a no-op.
import type { Db } from '../db';

export class IdempotencyStore {
  constructor(private readonly db: Db) {}

  /** Has `consumer` already processed `eventId`? */
  async alreadyProcessed(consumer: string, eventId: number): Promise<boolean> {
    const r = await this.db.query<{ one: number }>(
      `SELECT 1 AS one FROM stream_processed_events WHERE consumer=$1 AND event_id=$2 LIMIT 1`,
      [consumer, eventId],
    );
    return r.rowCount !== null && r.rowCount > 0;
  }

  /** Record that `consumer` processed `eventId`. Idempotent (ON CONFLICT DO NOTHING). */
  async markProcessed(consumer: string, eventId: number, tenantId: string | null, eventType: string): Promise<void> {
    await this.db.query(
      `INSERT INTO stream_processed_events (tenant_id, consumer, event_id, event_type)
         VALUES ($1,$2,$3,$4) ON CONFLICT (consumer, event_id) DO NOTHING`,
      [tenantId, consumer, eventId, eventType],
    );
  }
}
