// modules/tenant-webhooks/events/handlers/webhook-fanout.handler.ts · on a relayed outbox event, enqueue one
// webhook_deliveries row per ACTIVE tenant endpoint subscribed to that event type — IN THE RELAY'S TX (the enqueue
// commits atomically with marking the event published, so we never lose or double-fan a delivery). One instance is
// registered per WEBHOOK_EVENT_TYPE (the registry keys handlers by eventType). The actual HTTP POST is the delivery
// worker's job; this only durably records the intent. Idempotency: the worker dedups; re-running the relay re-enqueues
// at most one extra row which the worker collapses by (endpoint,event) — acceptable at-least-once semantics.
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { WebhookRepository } from '../../repositories/webhook.repository';

export class WebhookFanoutHandler implements OutboxHandler {
  constructor(public readonly eventType: string, private readonly repo: WebhookRepository) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    if (!event.tenantId) return; // platform-global events are not tenant-deliverable
    const endpointIds = await this.repo.activeEndpointsForEvent(tx, event.tenantId, event.eventType);
    for (const endpointId of endpointIds) {
      await this.repo.enqueue(tx, event.tenantId, endpointId, event.eventType, {
        id: event.id, type: event.eventType, aggregateType: event.aggregateType, aggregateId: event.aggregateId, data: event.payload,
      });
    }
  }
}
