// modules/fintech/__tests__/loan-application.service.spec.ts · disburse money-path unit test (fakes).
// Pins: disburse posts a ZERO-SUM tenant 'main' → borrower userMain transfer (txnType loan_disbursement),
// only after the cooling-off window, and creates the servicing loan with outstanding = principal.
import { LoanApplicationService } from '../services/loan-application.service';
import { LoanApplication } from '../domain/loan-application.entity';
import { LoanProduct } from '../domain/loan-product.entity';
import { CoolingOffActiveError } from '../domain/fintech.errors';

const product = LoanProduct.rehydrate({ id: 'pr1', partnerId: 'pn1', productKindId: 'k1', defaultName: 'Crop', currencyCode: 'INR', minAmountMinor: 100000n, maxAmountMinor: 50000000n, interestAprBps: 1100, tenureMonthsMin: 3, tenureMonthsMax: 12, collateralKind: 'none', repaymentStyle: 'harvest_aligned', isActive: true });
function approvedApp(coolingOffUntil: Date) {
  const a = LoanApplication.apply({ id: 'a1', tenantId: 't1', applicantUserId: 'u1', productId: 'pr1', partnerId: 'pn1', amountRequestedMinor: 5000000n, purposeText: null, nwrId: null });
  a.startReview(); a.approve(5000000n, coolingOffUntil, new Date()); a.pullEvents();
  return a;
}
function harness(app: LoanApplication) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(), increment: jest.fn() }; const metrics = { inc: jest.fn(), observe: jest.fn() }; const audit = { write: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 't', alreadyApplied: false })), balanceMinor: jest.fn() };
  const repo = { getForUpdate: jest.fn(async () => app), update: jest.fn() };
  const loans = { insert: jest.fn() };
  const products = { getById: jest.fn(async () => product) };
  const svc = new LoanApplicationService(uow as any, outbox as any, idem as any, quota as any, metrics as any, audit as any, wallet as any, repo as any, loans as any, products as any);
  return { svc, wallet, loans };
}
const lender = { userId: 'lender1', canBorrow: false, canManage: true };

describe('disburse — the money path', () => {
  it('posts a ZERO-SUM tenant→borrower loan_disbursement + opens the loan (outstanding = principal)', async () => {
    const { svc, wallet, loans } = harness(approvedApp(new Date(Date.now() - 1000)));  // cooling-off elapsed
    const out: any = await svc.disburse('t1', lender, 'a1', 'idem-d', null);
    expect(out.loan.status).toBe('active'); expect(out.loan.outstandingMinor).toBe('5000000');
    expect(loans.insert).toHaveBeenCalledTimes(1);
    const arg: any = (wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('loan_disbursement');
    expect(arg.legs.reduce((a: bigint, l: any) => a + l.amountMinor, 0n)).toBe(0n);   // ZERO-SUM
    expect(arg.legs.find((l: any) => l.amountMinor < 0n).account.kind).toBe('tenant');
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).account.userId).toBe('u1');  // borrower credited
    expect(arg.legs.find((l: any) => l.amountMinor > 0n).amountMinor).toBe(5000000n);
  });
  it('blocks disbursal during the cooling-off window (no money moved)', async () => {
    const { svc, wallet } = harness(approvedApp(new Date(Date.now() + 3600_000)));    // window open
    await expect(svc.disburse('t1', lender, 'a1', 'idem-d2', null)).rejects.toBeInstanceOf(CoolingOffActiveError);
    expect(wallet.post).not.toHaveBeenCalled();
  });
});
