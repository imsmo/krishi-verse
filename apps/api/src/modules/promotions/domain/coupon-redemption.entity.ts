// modules/promotions/domain/coupon-redemption.entity.ts · an APPEND-ONLY redemption record (the DB
// revokes UPDATE/DELETE on coupon_redemptions — history is physics). One per (coupon, order).
import { InvalidPromotionError } from './promotions.errors';

export interface CouponRedemptionProps { id: string; couponId: string; tenantId: string; userId: string; orderId: string; amountMinor: bigint; createdAt: Date; }

export class CouponRedemption {
  private constructor(readonly props: CouponRedemptionProps) {}
  static create(input: { id: string; couponId: string; tenantId: string; userId: string; orderId: string; amountMinor: bigint; now?: Date }): CouponRedemption {
    if (input.amountMinor < 0n) throw new InvalidPromotionError('redemption amount cannot be negative');
    if (!input.orderId) throw new InvalidPromotionError('orderId is required to redeem');
    return new CouponRedemption({ ...input, createdAt: input.now ?? new Date() });
  }
}
