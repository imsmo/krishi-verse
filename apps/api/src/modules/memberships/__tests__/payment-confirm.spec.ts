// modules/memberships/__tests__/payment-confirm.spec.ts · pure-domain tests for the W4-01 card/gateway
// activation path: UserMembership.confirmPayment (idempotent stamp + live-ensure). The handler/RLS are
// covered by the module integration spec.
import { UserMembership } from '../domain/user-membership.entity';
import { MembershipEventType } from '../domain/memberships.events';

function live(status: 'active' | 'past_due' = 'active') {
  return UserMembership.rehydrate({ id: 'm1', tenantId: 't1', userId: 'u1', tierId: 'tier1', status, billingCycle: 'monthly', currentPeriodEnd: new Date('2026-08-01T00:00:00Z'), paymentId: null, createdAt: new Date('2026-06-01T00:00:00Z') });
}

describe('UserMembership.confirmPayment', () => {
  it('stamps the payment once, reactivates a past_due member, and emits PaymentConfirmed', () => {
    const m = live('past_due'); m.pullEvents();
    expect(m.confirmPayment('pay_1')).toBe(true);
    expect(m.toProps().paymentId).toBe('pay_1');
    expect(m.status).toBe('active');
    expect(m.pullEvents().map((e) => e.type)).toContain(MembershipEventType.PaymentConfirmed);
  });
  it('is idempotent — a second confirm (or relay re-delivery) is a no-op, no event', () => {
    const m = live(); m.confirmPayment('pay_1'); m.pullEvents();
    expect(m.confirmPayment('pay_1')).toBe(false);
    expect(m.confirmPayment('pay_2')).toBe(false);     // already stamped → never overwritten
    expect(m.toProps().paymentId).toBe('pay_1');
    expect(m.pullEvents()).toHaveLength(0);
  });
  it('never resurrects a cancelled/expired membership, and ignores an empty paymentId', () => {
    const dead = UserMembership.rehydrate({ ...live().toProps(), status: 'cancelled' });
    expect(dead.confirmPayment('pay_1')).toBe(false);
    expect(live().confirmPayment('')).toBe(false);
  });
});
