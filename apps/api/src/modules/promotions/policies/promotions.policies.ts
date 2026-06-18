// modules/promotions/policies/promotions.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';
// Managing promotions/coupons needs promotion.manage (tenant marketing/admin). Validating + redeeming
// a coupon is any authenticated tenant user (the redeemer is ctx.userId; caps enforced in the service).
export const PromotionPermissions = { Manage: 'promotion.manage' } as const;
export function canManagePromotions(ctx: RequestContext): boolean {
  return ctx.permissions.has('promotion.manage') || ctx.permissions.has('*');
}
