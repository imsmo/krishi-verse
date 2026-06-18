// modules/disputes/events/handlers/order-delivered.handler.ts
// Consumes orders.order_delivered (delivered by the outbox relay). Records the dispute ELIGIBILITY for
// the order (its buyer + seller travel in the event — no cross-module read, Law 11) so a party can
// later raise a dispute and the counterparty is resolved server-side. Runs INSIDE the relay tx and
// touches only the disputes module's own table. IDEMPOTENT: one row per order (ON CONFLICT DO NOTHING).
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { DisputeRepository } from '../../repositories/dispute.repository';

@Injectable()
export class OrderDeliveredHandler implements OutboxHandler {
  readonly eventType = 'orders.order_delivered';
  constructor(private readonly repo: DisputeRepository) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    const orderId = (p.orderId as string | undefined) ?? event.aggregateId;
    const buyerUserId = p.buyerUserId as string | undefined;
    const sellerUserId = p.sellerUserId as string | undefined;
    if (!tenantId || !orderId || !buyerUserId || !sellerUserId) return;   // older event without parties → skip
    if (buyerUserId === sellerUserId) return;
    await this.repo.insertEligibility(tx, tenantId, orderId, buyerUserId, sellerUserId);
  }
}
