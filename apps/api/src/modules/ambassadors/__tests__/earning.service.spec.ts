// modules/ambassadors/__tests__/earning.service.spec.ts · AmbassadorEarningService unit tests with fakes.
// Pins: accrue is idempotent (existsFor guard) + skips when no plan / zero amount; payout posts ONE zero-sum
// 'commission' transfer (platform Fees → ambassador userMain), stamps payout_id, throws when nothing to pay.
import { AmbassadorEarningService } from '../services/ambassador-earning.service';
import { CommissionPlan } from '../domain/commission-plan.entity';
import { AmbassadorEarning } from '../domain/ambassador-earning.entity';
import { AmbassadorProfile } from '../domain/ambassador-profile.entity';
import { NothingToPayoutError } from '../domain/ambassadors.errors';

const plan = () => CommissionPlan.rehydrate({ id: 'p1', tenantId: null, eventCode: 'first_sale_facilitated', amountMinor: null, rateBps: 100, capMinor: 10000n, conditions: {}, isActive: true });
const profile = () => AmbassadorProfile.rehydrate({ id: 'a1', userId: 'ambUser', tenantId: 't1', clusterRegionIds: [], tierId: null, mentorAmbassadorId: null, trainingCompletedAt: null, kioskEnabled: false, aepsEnabled: false, monthlyStipendMinor: 0n, lastActivityAt: null, isActive: true });

function harness(opts: { exists?: boolean; planFound?: boolean; unpaid?: AmbassadorEarning[] } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 'tx1', alreadyApplied: false })) };
  const plans = { resolveEffective: jest.fn(async () => (opts.planFound === false ? null : plan())) };
  const earnings = { insert: jest.fn(), existsFor: jest.fn(async () => opts.exists ?? false), lockUnpaid: jest.fn(async () => opts.unpaid ?? []), markPaid: jest.fn(), listForAmbassador: jest.fn() };
  const profiles = { getById: jest.fn(async () => profile()) };
  const svc = new AmbassadorEarningService(uow as any, outbox as any, idem as any, metrics as any, wallet as any, plans as any, earnings as any, profiles as any);
  return { svc, tx, wallet, earnings };
}

describe('accrue', () => {
  it('inserts an earning when a plan resolves + not duplicate', async () => {
    const h = harness();
    const out = await h.svc.accrue(h.tx as any, { tenantId: 't1', ambassadorId: 'a1', eventCode: 'first_sale_facilitated', referenceType: 'order', referenceId: 'o1', baseMinor: 500000n });
    expect(out).not.toBeNull(); expect(out!.amountMinor).toBe(5000n); expect(h.earnings.insert).toHaveBeenCalledTimes(1);
  });
  it('skips (no insert) when already credited (idempotent)', async () => {
    const h = harness({ exists: true });
    const out = await h.svc.accrue(h.tx as any, { tenantId: 't1', ambassadorId: 'a1', eventCode: 'first_sale_facilitated', referenceType: 'order', referenceId: 'o1', baseMinor: 500000n });
    expect(out).toBeNull(); expect(h.earnings.insert).not.toHaveBeenCalled();
  });
  it('skips when no plan', async () => {
    const h = harness({ planFound: false });
    expect(await h.svc.accrue(h.tx as any, { tenantId: 't1', ambassadorId: 'a1', eventCode: 'nope', referenceType: null, referenceId: null, baseMinor: 1n })).toBeNull();
  });
});

describe('payoutAmbassador — the money path', () => {
  const earning = (amt: bigint) => AmbassadorEarning.rehydrate({ id: `e-${amt}`, tenantId: 't1', ambassadorId: 'a1', planId: 'p1', eventCode: 'x', referenceType: null, referenceId: null, amountMinor: amt, payoutId: null, createdAt: new Date() });
  it('posts ONE zero-sum platform→ambassador commission transfer + stamps payout_id', async () => {
    const h = harness({ unpaid: [earning(5000n), earning(2500n)] });
    const out = await h.svc.payoutAmbassador('t1', 'a1', 'idem-1');
    expect(out.paidMinor).toBe('7500'); expect(out.earningCount).toBe(2);
    expect(h.wallet.post).toHaveBeenCalledTimes(1);
    const arg: any = (h.wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('commission');
    expect(arg.legs.reduce((s: bigint, l: any) => s + l.amountMinor, 0n)).toBe(0n);   // ZERO-SUM
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).account.userId).toBe('ambUser');
    expect(h.earnings.markPaid).toHaveBeenCalledTimes(1);
  });
  it('throws NothingToPayout when no unpaid earnings (no wallet move)', async () => {
    const h = harness({ unpaid: [] });
    await expect(h.svc.payoutAmbassador('t1', 'a1', 'idem-2')).rejects.toBeInstanceOf(NothingToPayoutError);
    expect(h.wallet.post).not.toHaveBeenCalled();
  });
});
