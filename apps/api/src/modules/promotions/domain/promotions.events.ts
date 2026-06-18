// modules/promotions/domain/promotions.events.ts · integration events (via outbox, Law 4).
export const PromotionEventType = {
  PromotionCreated:  'promotions.promotion_created',
  PromotionUpdated:  'promotions.promotion_updated',
  CouponCreated:     'promotions.coupon_created',
  CouponRedeemed:    'promotions.coupon_redeemed',   // a coupon was applied to an order (discount recorded)
  BudgetExhausted:   'promotions.promotion_budget_exhausted',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const PROMO_TYPES = ['recharge_bonus', 'cashback', 'listing_boost', 'festival'] as const;
export const DISCOUNT_TYPES = ['percent', 'flat'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
