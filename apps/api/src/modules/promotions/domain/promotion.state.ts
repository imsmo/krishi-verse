// modules/promotions/domain/promotion.state.ts · the promotion's DERIVED status (Law 5: the one place
// validity is decided). `promotions` has no status column — validity is computed from is_active + the
// [starts_at, ends_at] window + the budget. A coupon is only redeemable while its promotion is 'active'.
export const PROMOTION_STATUSES = ['scheduled', 'active', 'paused', 'exhausted', 'expired'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export interface PromotionValidity { isActive: boolean; startsAt: Date; endsAt: Date; budgetMinor: bigint | null; spentMinor: bigint; }

export function derivePromotionStatus(p: PromotionValidity, now: Date): PromotionStatus {
  if (!p.isActive) return 'paused';
  if (now.getTime() < p.startsAt.getTime()) return 'scheduled';
  if (now.getTime() > p.endsAt.getTime()) return 'expired';
  if (p.budgetMinor != null && p.spentMinor >= p.budgetMinor) return 'exhausted';
  return 'active';
}
export function isRedeemable(p: PromotionValidity, now: Date): boolean { return derivePromotionStatus(p, now) === 'active'; }
