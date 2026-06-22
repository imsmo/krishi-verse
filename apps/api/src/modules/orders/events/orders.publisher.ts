// modules/orders/events/orders.publisher.ts
// Typed façade over the outbox writer for the orders module's integration events. Every event is written
// INSIDE the caller's db transaction (Law 4) so the state change and the event commit atomically — no
// event for a rolled-back write, none lost for a committed one. Payloads are versioned ({ v: 1, ... })
// and carry NO PII (ids + minor-unit amounts as strings only). Consumers are at-least-once + idempotent.
// Consolidates the ad-hoc outbox writes other order services made; the canonical place to emit order
// events from this module.
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { TxContext } from '../../../core/database/unit-of-work';
import { DomainEvent, OrderEventType } from '../domain/orders.events';

@Injectable()
export class OrdersPublisher {
  constructor(@Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}

  /** Emit a batch of an order aggregate's domain events (created/confirmed/…), each in the caller's tx. */
  async publish(tx: TxContext, tenantId: string, orderId: string, events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType: e.type, payload: { v: 1, ...e.payload } });
    }
  }

  /** A single order event (typed). */
  async emit(tx: TxContext, tenantId: string, orderId: string, eventType: OrderEventType, payload: Record<string, unknown>): Promise<void> {
    await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType, payload: { v: 1, orderId, ...payload } });
  }

  /** A line's delivered quantity was recorded (partial fulfilment, PRD §9.6). */
  async itemDelivered(tx: TxContext, tenantId: string, orderId: string, listingId: string, deliveredQuantity: number): Promise<void> {
    await this.emit(tx, tenantId, orderId, OrderEventType.ItemDelivered, { listingId, deliveredQuantity });
  }
}
