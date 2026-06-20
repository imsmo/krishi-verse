// modules/fintech/__tests__/fintech-domain.spec.ts · pure-domain unit tests: the application + loan state
// machines, the anti-predatory COOLING-OFF gate, the approved≤requested bound, and the repayment/outstanding
// math (exact bigint, closes at zero). No infra — UoW/outbox/wallet are the integration + service specs.
import { canTransition as aCan, isTerminal as aTerm, APP_STATUSES, AppStatus, IllegalAppTransitionError } from '../domain/loan-application.state';
import { canTransition as lCan, isServicing, LOAN_STATUSES, LoanStatus } from '../domain/loan.state';
import { LoanApplication } from '../domain/loan-application.entity';
import { Loan } from '../domain/loan.entity';
import { FintechEventType } from '../domain/fintech.events';
import { ApprovedExceedsRequestedError, CoolingOffActiveError, OverRepaymentError, InvalidLoanError } from '../domain/fintech.errors';

const app = (over: any = {}) => LoanApplication.apply({ id: 'a1', tenantId: 't1', applicantUserId: 'u1', productId: 'pr1', partnerId: 'pn1', amountRequestedMinor: 5000000n, purposeText: null, nwrId: null, ...over });
const NOW = new Date('2026-06-20T00:00:00Z');

describe('loan-application.state machine', () => {
  it('draft/submitted→review→approved→disbursed; reject/withdraw paths', () => {
    expect(aCan('submitted', 'under_review')).toBe(true);
    expect(aCan('under_review', 'approved')).toBe(true);
    expect(aCan('under_review', 'rejected')).toBe(true);
    expect(aCan('approved', 'disbursed')).toBe(true);
    expect(aCan('approved', 'withdrawn')).toBe(true);   // applicant cancels in cooling-off
    expect(aCan('submitted', 'disbursed')).toBe(false);
    expect(aTerm('disbursed')).toBe(true); expect(aTerm('rejected')).toBe(true);
    for (const s of APP_STATUSES) expect(() => aCan(s, 'withdrawn' as AppStatus)).not.toThrow();
    expect(new IllegalAppTransitionError('disbursed', 'draft').code).toBe('LOAN_APP_ILLEGAL_TRANSITION');
  });
});

describe('LoanApplication — approval, cooling-off, disbursal', () => {
  it('approve requires approved ≤ requested + opens the cooling-off window', () => {
    const a = app(); a.startReview();
    expect(() => a.approve(6000000n, NOW, NOW)).toThrow(ApprovedExceedsRequestedError);  // > requested
    const until = new Date(NOW.getTime() + 24 * 3600_000);
    a.approve(5000000n, until, NOW);
    expect(a.status).toBe('approved'); expect(a.amountApprovedMinor).toBe(5000000n); expect(a.coolingOffUntil).toEqual(until);
  });
  it('disburse is BLOCKED while the cooling-off window is open, allowed after', () => {
    const a = app(); a.startReview();
    const until = new Date(NOW.getTime() + 24 * 3600_000);
    a.approve(5000000n, until, NOW); a.pullEvents();
    expect(() => a.markDisbursed(NOW)).toThrow(CoolingOffActiveError);                    // still in window
    const after = new Date(until.getTime() + 1000);
    expect(a.markDisbursed(after)).toBe(5000000n); expect(a.status).toBe('disbursed');
    expect(a.pullEvents().map((e) => e.type)).toContain(FintechEventType.LoanDisbursed);
  });
  it('a zero cooling-off window disburses immediately', () => {
    const a = app(); a.startReview(); a.approve(5000000n, NOW, NOW);   // until = now → not < now
    expect(a.markDisbursed(NOW)).toBe(5000000n);
  });
});

describe('loan.state + repayment math', () => {
  const loan = () => Loan.open({ id: 'l1', applicationId: 'a1', tenantId: 't1', borrowerUserId: 'u1', partnerId: 'pn1', principalMinor: 5000000n, interestAprBps: 1100, disbursedAt: '2026-06-20', maturityDate: null, nextDueDate: null });
  it('transitions: active↔overdue, active|overdue→closed/written_off', () => {
    expect(lCan('active', 'overdue')).toBe(true); expect(lCan('overdue', 'active')).toBe(true);
    expect(lCan('active', 'closed')).toBe(true); expect(lCan('closed', 'active')).toBe(false);
    expect(isServicing('active')).toBe(true); expect(isServicing('closed')).toBe(false);
    for (const s of LOAN_STATUSES) expect(() => lCan(s, 'closed' as LoanStatus)).not.toThrow();
  });
  it('opens with outstanding = principal; repayments reduce it; closes at zero', () => {
    const l = loan(); expect(l.outstandingMinor).toBe(5000000n);
    l.repay(2000000n, NOW); expect(l.outstandingMinor).toBe(3000000n); expect(l.status).toBe('active');
    l.repay(3000000n, NOW); expect(l.outstandingMinor).toBe(0n); expect(l.status).toBe('closed');
    expect(l.pullEvents().map((e) => e.type)).toContain(FintechEventType.LoanClosed);
  });
  it('rejects over-repayment + repaying a closed loan', () => {
    const l = loan();
    expect(() => l.repay(9999999n, NOW)).toThrow(OverRepaymentError);
    l.repay(5000000n, NOW);                       // now closed
    expect(() => l.repay(1n, NOW)).toThrow(InvalidLoanError);
  });
});
