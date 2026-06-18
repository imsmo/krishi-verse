// modules/logistics/events/handlers/order-confirmed.handler.ts
// Consumes orders.order_confirmed (delivered by the outbox relay). Auto-creates ONE shipment (status
// 'pending') for the confirmed order so ops/riders can fulfil it. Runs INSIDE the relay tx and touches
// only the logistics module's own repository. IDEMPOTENT: if a shipment already exists for the order,
// no-op — so at-least-once re-delivery never creates duplicates.
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../../core/outbox/outbox.writer';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { uuidv7 } from '../../../../core/database/uuid.util';
import { Metrics, METRICS } from '../../../../core/observability/metrics';
import { Shipment } from '../../domain/shipment.entity';
import { DomainEvent } from '../../domain/logistics.events';
import { ShipmentRepository } from '../../repositories/shipment.repository';

@Injectable()
export class OrderConfirmedHandler implements OutboxHandler {
  readonly eventType = 'orders.order_confirmed';
  constructor(private readonly repo: ShipmentRepository, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter, @Inject(METRICS) private readonly metrics: Metrics) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const orderId = event.payload.orderId as string | undefined;
    if (!tenantId || !orderId) return;
    if (await this.repo.existsForOrder(tx, tenantId, orderId)) return;     // idempotent

    const shipment = Shipment.create({ id: uuidv7(), tenantId, orderId });
    await this.repo.insert(tx, shipment);
    await this.flush(tx, tenantId, shipment.id, shipment.pullEvents());
    this.metrics.inc('logistics.shipment_auto_created', { tenant: tenantId });
  }

  private async flush(tx: TxContext, tenantId: string, shipmentId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'shipment', aggregateId: shipmentId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
