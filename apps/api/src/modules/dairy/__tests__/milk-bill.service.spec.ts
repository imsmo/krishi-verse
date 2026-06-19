// modules/dairy/__tests__/milk-bill.service.spec.ts · MilkBillService unit tests with fakes.
// Pins THE MONEY PATH: pay() posts a ZERO-SUM wallet transfer tenant 'main' → farmer userMain (txnType
// milk_payment) ONLY when the bill is approved, and moves NO money on a non-approved bill. Real SQL/RLS =
// integration spec.
import { MilkBillService } from '../services/milk-bill.service';
import { MilkBill } from '../domain/milk-bill.entity';
import { DairyMembership } from '../domain/dairy-membership.entity';
import { BillNotPayableError } from '../domain/dairy.errors';

const membership = DairyMembership.rehydrate({ id: 'mem1', tenantId: 't1', farmerUserId: 'farmer1', mccId: 'm1', memberCode: 'C1', paymentCycle: 'weekly', defaultAnimalType: 'cow', isActive: true });

function harness(bill: MilkBill) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn() };
  const wallet = { post: jest.fn(async () => ({ txnId: 't', alreadyApplied: false })), balanceMinor: jest.fn() };
  const bills = { getForUpdate: jest.fn(async () => bill), update: jest.fn(), getById: jest.fn(), listFor: jest.fn(), insert: jest.fn() };
  const collections = { aggregateUnbilledForUpdate: jest.fn(), attachToBill: jest.fn() };
  const memberships = { getById: jest.fn(async () => membership), listFor: jest.fn() };
  const svc = new MilkBillService(uow as any, outbox as any, idem as any, metrics as any, wallet as any, audit as any, bills as any, collections as any, memberships as any);
  return { svc, wallet, bills };
}
const approvedBill = () => { const b = MilkBill.generate({ id: 'b1', tenantId: 't1', membershipId: 'mem1', periodStart: '2026-06-01', periodEnd: '2026-06-07', totalLitresMilli: 70000n, grossMinor: 48000n, deductions: [{ type: 'feed', amountMinor: 8000n }] }); b.preview(); b.approve(); b.pullEvents(); return b; };
const actor = { userId: 'op1', canManage: true };

describe('MilkBillService.pay — the money path', () => {
  it('posts a ZERO-SUM tenant→farmer milk_payment for the NET, then marks paid', async () => {
    const { svc, wallet, bills } = harness(approvedBill());
    const out = await svc.pay('t1', actor, 'b1', 'idem-pay', null);
    expect(out.status).toBe('paid');
    expect(wallet.post).toHaveBeenCalledTimes(1);
    const arg: any = (wallet.post.mock.calls as any[])[0][1];
    expect(arg.txnType).toBe('milk_payment'); expect(arg.idempotencyKey).toBe('milkbill:b1');
    expect(arg.legs.reduce((a: bigint, l: any) => a + l.amountMinor, 0n)).toBe(0n);             // ZERO-SUM
    const debit = arg.legs.find((l: any) => l.amountMinor < 0n); const credit = arg.legs.find((l: any) => l.amountMinor > 0n);
    expect(debit.account.kind).toBe('tenant'); expect(debit.amountMinor).toBe(-40000n);          // tenant main debited NET
    expect(credit.account.kind).toBe('user'); expect(credit.account.userId).toBe('farmer1'); expect(credit.amountMinor).toBe(40000n); // farmer credited
    expect(bills.update).toHaveBeenCalledTimes(1);
  });
  it('refuses to pay a non-approved bill and moves NO money', async () => {
    const draft = MilkBill.generate({ id: 'b1', tenantId: 't1', membershipId: 'mem1', periodStart: '2026-06-01', periodEnd: '2026-06-07', totalLitresMilli: 1n, grossMinor: 1000n });
    const { svc, wallet } = harness(draft);
    await expect(svc.pay('t1', actor, 'b1', 'idem-pay', null)).rejects.toBeInstanceOf(BillNotPayableError);
    expect(wallet.post).not.toHaveBeenCalled();
  });
});
