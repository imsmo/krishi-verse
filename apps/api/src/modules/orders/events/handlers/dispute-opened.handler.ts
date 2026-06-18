// modules/orders/events/handlers/dispute-opened.handler.ts
// Consumes disputes.dispute_opened (delivered by the outbox relay). Moves the order to 'disputed' so
// it is PAUSED — the auto-complete/quality-window job won't complete it (and settlement won't release)
// while a dispute is open. Runs INSIDE the relay tx. IDEMPOTENT: skips if the order isn't in a state
// from which 'disputed' is a legal transition (already disputed / terminal).
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../../core/outbox/outbox.writer';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { OrderRepository } from '../../repositories/order.repository';
import { canTransition } from '../../domain/order.state';

@Injectable()
export class DisputeOpenedHandler implements OutboxHandler {
  readonly eventType = 'disputes.dispute_opened';
  constructor(private readonly repo: OrderRepository, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const orderId = event.payload.orderId as string | undefined;
    if (!tenantId || !orderId) return;
    const order = await this.repo.getForUpdate(tx, tenantId, orderId);
    if (!order) return;
    if (!canTransition(order.status, 'disputed')) return;     // idempotent / not applicable
    const from = order.status;
    order.dispute('system');
    await this.repo.update(tx, order, from);
    for (const e of order.pullEvents()) await this.outbox.write(tx, { tenantId, aggregateType: 'order', aggregateId: orderId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
