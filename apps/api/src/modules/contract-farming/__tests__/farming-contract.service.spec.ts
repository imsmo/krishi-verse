// modules/contract-farming/__tests__/farming-contract.service.spec.ts · settleGrower unit tests (fakes).
// Pins THE SETTLEMENT MONEY PATH: pay = gross − recovered, posting a ZERO-SUM buyer→grower contract_payment
// for the NET only, and recovering outstanding advances (oldest first). Real SQL/RLS = integration spec.
import { FarmingContractService } from '../services/farming-contract.service';
import { FarmingContract } from '../domain/farming-contract.entity';
import { ContractGrower } from '../domain/contract-grower.entity';
import { InputAdvance } from '../domain/input-advance.entity';

const contract = () => { const c = FarmingContract.create({ id: 'c1', tenantId: 't1', contractNo: 'CF-X', templateId: null, buyerUserId: 'buyer1', contractKind: 'forward', productId: 'p1', totalQuantityMilli: 100000n, unitCode: 'quintal', priceModel: 'fixed', priceTerms: { fixed_minor: '50000' }, qualitySpec: {}, season: null }); c.propose(); c.sign(new Date()); c.activate(); c.pullEvents(); return c; };
const grower = ContractGrower.rehydrate({ id: 'g1', contractId: 'c1', tenantId: 't1', farmerUserId: 'farmer1', landParcelId: null, committedQuantityMilli: 100000n });

function harness(advances: InputAdvance[]) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(), increment: jest.fn() }; const metrics = { inc: jest.fn(), observe: jest.fn() }; const audit = { write: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 't', alreadyApplied: false })), balanceMinor: jest.fn() };
  const repo = { getForUpdate: jest.fn(async () => contract()) };
  const growers = { getById: jest.fn(async () => grower) };
  const advRepo = { listOutstandingForUpdate: jest.fn(async () => advances), updateRecovered: jest.fn() };
  const svc = new FarmingContractService(uow as any, outbox as any, idem as any, quota as any, metrics as any, audit as any, wallet as any, repo as any, growers as any, advRepo as any);
  return { svc, wallet, advRepo };
}
const buyer = { userId: 'buyer1', canManage: true, isAdmin: false };
const adv = (v: bigint) => InputAdvance.disburse({ id: `a-${v}`, contractId: 'c1', growerId: 'g1', tenantId: 't1', productId: null, description: null, valueMinor: v });

describe('settleGrower — net of advance recovery', () => {
  it('gross ₹5000, advance ₹2000 → recover ₹2000, pay net ₹3000 (zero-sum buyer→grower)', async () => {
    const { svc, wallet, advRepo } = harness([adv(200000n)]);
    const out = await svc.settleGrower('t1', buyer, 'c1', 'idem-s', { growerId: 'g1', deliveredQuantity: '10.000' } as any, null);
    expect(out.grossMinor).toBe('500000'); expect(out.recoveredMinor).toBe('200000'); expect(out.netMinor).toBe('300000');
    expect(advRepo.updateRecovered).toHaveBeenCalledTimes(1);
    const arg: any = (wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('contract_payment');
    expect(arg.legs.reduce((a: bigint, l: any) => a + l.amountMinor, 0n)).toBe(0n);    // ZERO-SUM
    expect(arg.legs.find((l: any) => l.amountMinor < 0n).account.userId).toBe('buyer1');
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).account.userId).toBe('farmer1');
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).amountMinor).toBe(300000n);
  });
  it('advance ≥ gross → fully recovered, net 0, NO wallet move', async () => {
    const { svc, wallet } = harness([adv(600000n)]);
    const out = await svc.settleGrower('t1', buyer, 'c1', 'idem-s2', { growerId: 'g1', deliveredQuantity: '10.000' } as any, null);
    expect(out.recoveredMinor).toBe('500000'); expect(out.netMinor).toBe('0');         // recovery capped at gross
    expect(wallet.post).not.toHaveBeenCalled();
  });
});
