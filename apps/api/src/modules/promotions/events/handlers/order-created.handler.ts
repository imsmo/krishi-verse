// modules/promotions/events/handlers/order-created.handler.ts
// Consumes orders.order_created (delivered by the outbox relay). When an order was placed WITH a coupon,
// ensure the redemption is recorded against the coupon + promotion. This is the DECOUPLED / backstop path:
// the coupon code + applied discount travel IN the event (orders never imports promotions' repo — Law 11),
// and the recorder is idempotent on the UNIQUE (coupon_id, order_id) — so for the normal flow, where
// checkout already redeemed synchronously in its own tx, this is a harmless no-op (the row exists). It
// becomes the SOLE recorder for any future order-creation path that honours a coupon outside checkout.
// Runs INSIDE the relay tx; touches only promotions' own tables; no money (a discount is a price cut).
import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { CouponRedemptionService } from '../../services/coupon-redemption.service';

@Injectable()
export class OrderCreatedHandler implements OutboxHandler {
  readonly eventType = 'orders.order_created';
  constructor(private readonly redemptions: CouponRedemptionService) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    if (!tenantId) return;
    const couponCode = typeof p.couponCode === 'string' ? p.couponCode : undefined;
    const buyerUserId = typeof p.buyerUserId === 'string' ? p.buyerUserId : undefined;
    const orderId = typeof p.orderId === 'string' ? p.orderId : event.aggregateId;
    const discountMinor = typeof p.discountMinor === 'string' && /^\d+$/.test(p.discountMinor) ? BigInt(p.discountMinor) : 0n;
    if (!couponCode || !buyerUserId || discountMinor <= 0n) return;   // no coupon on this order → nothing to record
    await this.redemptions.recordFromOrder(tx, tenantId, { orderId, couponCode, userId: buyerUserId, discountMinor });
  }
}
