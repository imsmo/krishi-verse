// modules/ambassadors/__tests__/ambassadors-domain.spec.ts · pure-domain invariants (no I/O).
// Pins: commission compute (flat / rate×base / cap, float-free); referral state machine + self-referral guard;
// earning rejects non-positive; profile suspend idempotent.
import { CommissionPlan } from '../domain/commission-plan.entity';
import { Referral } from '../domain/referral.entity';
import { AmbassadorEarning } from '../domain/ambassador-earning.entity';
import { AmbassadorProfile } from '../domain/ambassador-profile.entity';
import { IllegalReferralTransitionError } from '../domain/referral.state';
import { InvalidReferralError } from '../domain/ambassadors.errors';

const plan = (over: Partial<any> = {}) => CommissionPlan.rehydrate({ id: 'p1', tenantId: null, eventCode: 'first_sale_facilitated', amountMinor: null, rateBps: 100, capMinor: 10000n, conditions: {}, isActive: true, ...over });

describe('CommissionPlan.compute', () => {
  it('rate_bps of base, floored, capped at cap_minor', () => {
    expect(plan().compute(500000n)).toBe(5000n);          // 1% of 5000.00 = 50.00
    expect(plan().compute(5000000n)).toBe(10000n);        // 1% = 500.00 but capped at 100.00
    expect(plan({ rateBps: 33 }).compute(101n)).toBe(0n); // floor(101*33/10000)=0
  });
  it('flat amount_minor ignores base', () => {
    expect(plan({ amountMinor: 2500n, rateBps: null, capMinor: null }).compute(999999n)).toBe(2500n);
  });
});

describe('Referral', () => {
  const mk = () => Referral.create({ id: 'r1', tenantId: 't1', referrerUserId: 'amb', refereeUserId: null, code: 'KRISHI10', rewardRule: {} });
  it('invited→signed_up→activated→rewarded; cannot skip', () => {
    const r = mk(); r.signUp('newuser'); expect(r.status).toBe('signed_up');
    r.activate(); expect(r.status).toBe('activated'); r.markRewarded('txn'); expect(r.status).toBe('rewarded');
    expect(() => r.signUp('x')).toThrow(IllegalReferralTransitionError);
  });
  it('rejects self-referral and a bad code', () => {
    expect(() => mk().signUp('amb')).toThrow(InvalidReferralError);
    expect(() => Referral.create({ id: 'r', tenantId: 't', referrerUserId: 'a', refereeUserId: null, code: 'lowercase!', rewardRule: {} })).toThrow(InvalidReferralError);
  });
});

describe('AmbassadorEarning + Profile', () => {
  it('earning must be positive', () => {
    expect(() => AmbassadorEarning.accrue({ id: 'e', tenantId: 't', ambassadorId: 'a', planId: 'p', eventCode: 'x', referenceType: null, referenceId: null, amountMinor: 0n })).toThrow();
  });
  it('profile suspend is idempotent + emits once', () => {
    const a = AmbassadorProfile.enroll({ id: 'a1', userId: 'u1', tenantId: 't1', clusterRegionIds: [], tierId: null, mentorAmbassadorId: null, trainingCompletedAt: null, kioskEnabled: false, aepsEnabled: false, monthlyStipendMinor: 0n });
    a.pullEvents(); a.suspend(); expect(a.isActive).toBe(false);
    expect(a.pullEvents()).toHaveLength(1); a.suspend(); expect(a.pullEvents()).toHaveLength(0);
  });
});
