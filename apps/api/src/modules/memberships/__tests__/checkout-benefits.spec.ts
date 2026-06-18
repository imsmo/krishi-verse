// modules/memberships/__tests__/checkout-benefits.spec.ts · unit: UserMembershipService.checkoutBenefits
// — the tx-aware benefit lookup orders' checkout uses. Mocks the repos; asserts it surfaces freeDelivery
// + platform_fee_bps_override for a LIVE membership, and null when there is none / it's not live.
import { UserMembershipService } from '../services/user-membership.service';
import { MembershipTier, parseBenefits } from '../domain/membership-tier.entity';
import { UserMembership } from '../domain/user-membership.entity';

function harness(membership: UserMembership | null, tier: MembershipTier | null) {
  const repo = { findLiveForUser: jest.fn().mockResolvedValue(membership) } as any;
  const tiers = { getSubscribable: jest.fn().mockResolvedValue(tier) } as any;
  const svc = new UserMembershipService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, tiers, repo);
  return { svc, repo, tiers, tx: { query: jest.fn() } as any };
}
const liveMembership = () => UserMembership.subscribe({ id: 'm1', tenantId: 't1', userId: 'u1', tierId: 'tier1', billingCycle: 'monthly' });
const tierWith = (over: number | null, freeDelivery: boolean) => MembershipTier.create({ id: 'tier1', tenantId: 't1', code: 'plus', defaultName: 'Plus', monthlyFeeMinor: 9900n, platformFeeBpsOverride: over, benefits: parseBenefits({ freeDelivery }) });

describe('UserMembershipService.checkoutBenefits', () => {
  it('surfaces the live membership tier benefits (freeDelivery + platform fee bps override)', async () => {
    const { svc, tx } = harness(liveMembership(), tierWith(100, true));
    const ben = await svc.checkoutBenefits(tx, 't1', 'u1');
    expect(ben).toEqual({ freeDelivery: true, platformFeeBpsOverride: 100 });
  });
  it('returns null platform override when the tier has none', async () => {
    const { svc, tx } = harness(liveMembership(), tierWith(null, false));
    const ben = await svc.checkoutBenefits(tx, 't1', 'u1');
    expect(ben).toEqual({ freeDelivery: false, platformFeeBpsOverride: null });
  });
  it('returns null when the user has no live membership, or the tier is gone', async () => {
    expect(await harness(null, tierWith(100, true)).svc.checkoutBenefits({ query: jest.fn() } as any, 't1', 'u1')).toBeNull();
    expect(await harness(liveMembership(), null).svc.checkoutBenefits({ query: jest.fn() } as any, 't1', 'u1')).toBeNull();
  });
});
