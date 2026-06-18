// modules/reviews/events/handlers/order-completed.handler.ts
// Consumes orders.order_completed (delivered by the outbox relay). Records the verified-purchase
// ELIGIBILITY for that order (its buyer + seller travel in the event — no cross-module read, Law 11),
// which later authorizes a buyer→seller AND a seller→buyer review. Runs INSIDE the relay tx and touches
// only the reviews module's own table. IDEMPOTENT: one eligibility row per order (ON CONFLICT DO NOTHING).
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { ReviewRepository } from '../../repositories/review.repository';

@Injectable()
export class OrderCompletedHandler implements OutboxHandler {
  readonly eventType = 'orders.order_completed';
  constructor(private readonly repo: ReviewRepository) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    const orderId = event.aggregateId;
    const buyerUserId = p.buyerUserId as string | undefined;
    const sellerUserId = p.sellerUserId as string | undefined;
    if (!tenantId || !orderId || !buyerUserId || !sellerUserId) return;     // malformed → ignore
    if (buyerUserId === sellerUserId) return;                               // defensive: no self-review
    await this.repo.insertEligibility(tx, tenantId, orderId, buyerUserId, sellerUserId);
  }
}
