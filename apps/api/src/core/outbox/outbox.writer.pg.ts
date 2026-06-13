// core/outbox/outbox.writer.pg.ts
// Concrete OutboxWriter. Inserts the event into outbox_events INSIDE the caller's
// transaction (Law 4) — the business row and its events commit atomically or not
// at all. The outbox-relay later polls (FOR UPDATE SKIP LOCKED) and publishes to
// SQS/Kafka/OpenSearch. This is how we get exactly-once-ish delivery without a
// distributed transaction.
import { Injectable } from '@nestjs/common';
import { OutboxWriter, OutboxEventInput } from './outbox.writer';
import { TxContext } from '../database/unit-of-work';

@Injectable()
export class PgOutboxWriter extends OutboxWriter {
  async write(tx: TxContext, e: OutboxEventInput): Promise<void> {
    await tx.query(
      `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [e.tenantId, e.aggregateType, e.aggregateId, e.eventType, JSON.stringify(e.payload)],
    );
  }
}
