// core/outbox/outbox.writer.ts
// Writes a domain event into outbox_events INSIDE the caller's transaction
// (Law 4). The outbox-relay later publishes it to SQS/Kafka/OpenSearch.
import { TxContext } from '../database/unit-of-work';
export interface OutboxEventInput {
  tenantId: string | null; aggregateType: string; aggregateId: string;
  eventType: string; payload: Record<string, unknown>;
}
export abstract class OutboxWriter { abstract write(tx: TxContext, e: OutboxEventInput): Promise<void>; }
export const OUTBOX_WRITER = Symbol('OUTBOX_WRITER');
