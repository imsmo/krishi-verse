// modules/payments/policies/payments.policies.ts · permission keys (DB-backed RBAC, Law 6).
import { RequestContext } from '../../../core/tenancy-context/request-context';

export const PaymentPermissions = {
  // Creating a payment intent needs only authentication (a user pays for themselves); refunds are
  // privileged (manual wallet adjustment / moderation).
  Refund: 'wallet.adjust',
} as const;

/** Moderator (tenant-admin) able to refund / view any payment in the tenant. NOT god-mode. */
export function canModeratePayment(ctx: RequestContext): boolean {
  return ctx.permissions.has('wallet.adjust') || ctx.permissions.has('payout.approve') || ctx.permissions.has('*');
}
