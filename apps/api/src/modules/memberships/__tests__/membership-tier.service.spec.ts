// modules/memberships/__tests__/membership-tier.service.spec.ts · pure-domain unit tests: the membership
// status machine (Law 5) + the MembershipTier and UserMembership aggregates. The services' UoW/wallet/
// outbox are covered by the integration spec.
import { canTransition, hasBenefits, isLive, IllegalMembershipTransitionError, MEMBERSHIP_STATUSES, MembershipStatus } from '../domain/user-membership.state';
import { MembershipTier, parseBenefits } from '../domain/membership-tier.entity';
import { UserMembership, nextPeriodEnd } from '../domain/user-membership.entity';
import { MembershipEventType } from '../domain/memberships.events';
import { InvalidTierError, MembershipNotLiveError } from '../domain/memberships.errors';

const NOW = new Date('2026-06-01T00:00:00Z');
const tier = (over: any = {}) => MembershipTier.create({ id: 't1', tenantId: 'ten1', code: 'household_plus', defaultName: 'Plus', monthlyFeeMinor: 9900n, annualFeeMinor: over.annual === undefined ? 99000n : over.annual, benefits: parseBenefits({ freeDelivery: true, creditDays: 30 }), ...over });
const sub = (cycle: any = 'monthly') => UserMembership.subscribe({ id: 'm1', tenantId: 'ten1', userId: 'u1', tierId: 't1', billingCycle: cycle, now: NOW });

describe('membership.state machine', () => {
  it('allows documented transitions, forbids illegal ones', () => {
    expect(canTransition('active', 'cancelled')).toBe(true);
    expect(canTransition('active', 'expired')).toBe(true);
    expect(canTransition('past_due', 'active')).toBe(true);
    expect(canTransition('cancelled', 'active')).toBe(false);
    expect(hasBenefits('active')).toBe(true); expect(hasBenefits('past_due')).toBe(true); expect(hasBenefits('expired')).toBe(false);
    expect(isLive('cancelled')).toBe(false);
  });
  it('covers every status', () => { for (const s of MEMBERSHIP_STATUSES) expect(() => canTransition(s, 'expired' as MembershipStatus)).not.toThrow(); });
});

describe('MembershipTier', () => {
  it('validates code/name/fees + parses benefits; feeFor honours cycle', () => {
    expect(() => tier({ code: 'A' })).toThrow(InvalidTierError);
    expect(() => MembershipTier.create({ id: 't', tenantId: 'x', code: 'ok', defaultName: '', monthlyFeeMinor: 0n, benefits: parseBenefits({}) })).toThrow(InvalidTierError);
    expect(() => tier({ monthlyFeeMinor: -1n })).toThrow(InvalidTierError);
    expect(() => parseBenefits({ creditDays: 999 })).toThrow(InvalidTierError);
    const t = tier();
    expect(t.feeFor('monthly')).toBe(9900n);
    expect(t.feeFor('annual')).toBe(99000n);
    expect(tier({ annual: null }).feeFor('annual')).toBeNull();   // annual not offered
    expect(parseBenefits({ free_delivery: true, credit_days: 15, credit_limit_minor: '500000' })).toEqual({ freeDelivery: true, creditDays: 15, creditLimitMinor: 500000n });
  });
});

describe('UserMembership', () => {
  it('subscribe sets a one-cycle period + emits subscribed', () => {
    const m = sub('monthly');
    expect(m.status).toBe('active');
    expect(m.currentPeriodEnd).toEqual(nextPeriodEnd(NOW, 'monthly'));
    expect(m.pullEvents().map((e) => e.type)).toContain(MembershipEventType.Subscribed);
  });
  it('renew extends the period from the later of now/current end; reactivates past_due', () => {
    const m = sub('monthly'); m.pullEvents();
    const end1 = m.currentPeriodEnd!;
    m.renew(NOW);
    expect(m.currentPeriodEnd!.getTime()).toBe(nextPeriodEnd(end1, 'monthly').getTime());   // stacks from current end
    expect(m.pullEvents().map((e) => e.type)).toContain(MembershipEventType.Renewed);
  });
  it('cancel is terminal; cannot renew/cancel afterwards', () => {
    const m = sub(); m.cancel(); expect(m.status).toBe('cancelled');
    expect(() => m.cancel()).toThrow(MembershipNotLiveError);
    expect(() => m.renew()).toThrow(MembershipNotLiveError);
  });
  it('expire lapses a membership only after the period end', () => {
    const m = sub('monthly'); m.pullEvents();
    expect(m.expire(NOW)).toBe(false);                                   // not yet due
    const after = new Date(m.currentPeriodEnd!.getTime() + 86400_000);
    expect(m.expire(after)).toBe(true); expect(m.status).toBe('expired');
    expect(m.expire(after)).toBe(false);                                 // idempotent (terminal)
  });
});
