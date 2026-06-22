// modules/promotions/services/coupon-redemption.service.ts
// The redemption-ledger use-cases, split out from CouponService (which owns the SYNCHRONOUS, budget-enforced
// redeem at checkout). This service owns the DECOUPLED / backstop recorder driven by the order lifecycle:
// when an order that carried a coupon is created, ensure the redemption is recorded exactly once (the same
// coupon_redemptions row checkout already wrote → idempotent), incrementing the coupon use + promo spend
// only when THIS call is the one that inserted it. No wallet movement (a discount is a price reduction;
// spent_minor is promo accounting — Law 2). Runs INSIDE the relay tx (Law 4 events emitted there).
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { CouponRedemption } from '../domain/coupon-redemption.entity';
import { PromotionEventType, DomainEvent } from '../domain/promotions.events';
import { CouponRepository } from '../repositories/coupon.repository';
import { PromotionRepository } from '../repositories/promotion.repository';
import { CouponRedemptionRepository } from '../repositories/coupon-redemption.repository';

@Injectable()
export class CouponRedemptionService {
  constructor(
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly coupons: CouponRepository,
    private readonly promos: PromotionRepository,
    private readonly redemptions: CouponRedemptionRepository,
  ) {}

  /** Idempotent recorder for the order-created handler. If the order carried a coupon + discount, ensure a
   *  coupon_redemptions row exists for (coupon, order); only when THIS call inserts it (i.e. checkout's
   *  synchronous redeem didn't already) does it increment the coupon use + promo spend and emit
   *  CouponRedeemed. Returns whether it recorded a NEW redemption. NEVER throws on budget (the discount is
   *  already on the order — enforceBudget:false), so a relay re-delivery is a harmless no-op. */
  async recordFromOrder(tx: TxContext, tenantId: string, input: { orderId: string; couponCode: string; userId: string; discountMinor: bigint }): Promise<{ recorded: boolean }> {
    if (input.discountMinor <= 0n) return { recorded: false };
    const coupon = await this.coupons.getByCodeForUpdate(tx, tenantId, input.couponCode);
    if (!coupon) return { recorded: false };                       // code no longer exists → nothing to record

    const redemption = CouponRedemption.create({ id: uuidv7(), couponId: coupon.id, tenantId, userId: input.userId, orderId: input.orderId, amountMinor: input.discountMinor });
    const inserted = await this.redemptions.insert(tx, redemption);   // ON CONFLICT(coupon_id, order_id) DO NOTHING
    if (!inserted) return { recorded: false };                      // already recorded (e.g. by checkout) → no double count

    coupon.consumeUse();
    await this.coupons.updateUses(tx, coupon);
    const events: DomainEvent[] = [{ type: PromotionEventType.CouponRedeemed, payload: { couponId: coupon.id, promotionId: coupon.promotionId, orderId: input.orderId, userId: input.userId, discountMinor: input.discountMinor.toString() } }];

    const promo = await this.promos.getForUpdate(tx, tenantId, coupon.promotionId);
    if (promo) {
      promo.recordSpend(input.discountMinor, { enforceBudget: false });   // accounting only; never fails the relay
      await this.promos.update(tx, promo);
      events.push(...promo.pullEvents());
    }
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'coupon', aggregateId: coupon.id, eventType: e.type, payload: { v: 1, ...e.payload } });
    return { recorded: true };
  }

  /** A buyer's own redemption history (read). */
  async listMine(tenantId: string, userId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    const items = await this.redemptions.listForUser(tenantId, userId, q);
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
