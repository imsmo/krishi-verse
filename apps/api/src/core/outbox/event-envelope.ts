// core/outbox/event-envelope.ts · the shape a consumer sees + the handler contract.
import { TxContext } from '../database/unit-of-work';

/** A relayed outbox event, as delivered to a consumer. */
export interface OutboxEvent {
  id: string;                 // outbox_events.id (bigserial as string)
  tenantId: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/** A consumer of integration events. MUST be idempotent — the relay delivers at-least-once and a
 *  handler may run again after a crash/retry. It runs INSIDE the relay's per-event transaction
 *  (the handler's writes + marking the event published commit atomically). */
export interface OutboxHandler {
  readonly eventType: string;
  handle(event: OutboxEvent, tx: TxContext): Promise<void>;
}

export const OUTBOX_DISPATCHER = Symbol('OUTBOX_DISPATCHER');
export const OUTBOX_HANDLER_REGISTRY = Symbol('OUTBOX_HANDLER_REGISTRY');
