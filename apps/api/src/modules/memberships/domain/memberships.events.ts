// modules/memberships/domain/memberships.events.ts · integration events (via outbox, Law 4).
export const MembershipEventType = {
  TierCreated:  'memberships.tier_created',
  TierUpdated:  'memberships.tier_updated',
  Subscribed:   'memberships.subscribed',
  Renewed:      'memberships.renewed',
  Cancelled:    'memberships.cancelled',
  Expired:      'memberships.expired',
  PaymentConfirmed: 'memberships.payment_confirmed',   // a card/gateway payment for this subscription settled (payments.payment_succeeded, referenceType 'membership')
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
