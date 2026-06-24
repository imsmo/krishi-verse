// apps/web-partner/src/test/loan.spec.ts · unit tests for the pure portfolio / repayment helpers.
import {
  LOAN_STATUSES, isLoanStatus, isServicing, loanStatusKey, loanStatusTone,
  repaidMinor, repaymentBalanceMinor, isRepaymentSettled, isPastDue, isRepaymentOverdue,
  buildLoanListQuery, portfolioHref,
} from '../features/lending/loan';

describe('loan state', () => {
  it('mirrors the API statuses + servicing + key/tone', () => {
    expect(LOAN_STATUSES).toEqual(['active', 'overdue', 'closed', 'written_off']);
    expect(isLoanStatus('overdue')).toBe(true);
    expect(isLoanStatus('nope')).toBe(false);
    expect(isServicing('active')).toBe(true);
    expect(isServicing('overdue')).toBe(true);
    expect(isServicing('closed')).toBe(false);
    expect(loanStatusKey('active')).toBe('loan2.st.active');
    expect(loanStatusKey('nope')).toBe('loan2.st.unknown');
    expect(loanStatusTone('active')).toBe('info');
    expect(loanStatusTone('overdue')).toBe('danger');
    expect(loanStatusTone('closed')).toBe('ok');
  });
});

describe('money (bigint, float-free)', () => {
  it('repaid = principal − outstanding, clamped ≥ 0', () => {
    expect(repaidMinor('1000000', '400000')).toBe('600000');
    expect(repaidMinor('1000000', '1000000')).toBe('0');
    expect(repaidMinor('1000000', '0')).toBe('1000000');
    expect(repaidMinor('1000000', '1200000')).toBe('0'); // never negative
    expect(repaidMinor('99999999999999999999', '1')).toBe('99999999999999999998'); // big-int safe
  });
  it('repayment balance = due − paid, clamped ≥ 0', () => {
    expect(repaymentBalanceMinor('50000', '20000')).toBe('30000');
    expect(repaymentBalanceMinor('50000', '50000')).toBe('0');
    expect(repaymentBalanceMinor('50000', '60000')).toBe('0');
  });
});

describe('repayment settled / overdue', () => {
  it('settled when paidAt present or paid covers due', () => {
    expect(isRepaymentSettled('50000', '0', '2026-01-01T00:00:00Z')).toBe(true);
    expect(isRepaymentSettled('50000', '50000', null)).toBe(true);
    expect(isRepaymentSettled('50000', '20000', null)).toBe(false);
  });
  it('isPastDue: lexicographic ISO-date compare', () => {
    expect(isPastDue('2026-06-01', '2026-06-22')).toBe(true);
    expect(isPastDue('2026-06-30', '2026-06-22')).toBe(false);
    expect(isPastDue('', '2026-06-22')).toBe(false);
  });
  it('overdue = unsettled AND past due', () => {
    const today = '2026-06-22';
    expect(isRepaymentOverdue({ dueDate: '2026-06-01', amountDueMinor: '50000', amountPaidMinor: '0', paidAt: null }, today)).toBe(true);
    expect(isRepaymentOverdue({ dueDate: '2026-06-01', amountDueMinor: '50000', amountPaidMinor: '50000', paidAt: null }, today)).toBe(false); // settled
    expect(isRepaymentOverdue({ dueDate: '2026-07-01', amountDueMinor: '50000', amountPaidMinor: '0', paidAt: null }, today)).toBe(false); // future
  });
});

describe('portfolio list query + href', () => {
  it('always box=all; status validated; keyset', () => {
    expect(buildLoanListQuery({})).toEqual({ box: 'all', status: undefined, cursor: undefined, limit: 50 });
    expect(buildLoanListQuery({ status: 'overdue', cursor: 'c1' })).toEqual({ box: 'all', status: 'overdue', cursor: 'c1', limit: 50 });
    expect(buildLoanListQuery({ status: 'nope' })).toEqual({ box: 'all', status: undefined, cursor: undefined, limit: 50 });
  });
  it('portfolioHref preserves status + cursor', () => {
    expect(portfolioHref()).toBe('/portfolio');
    expect(portfolioHref('overdue')).toBe('/portfolio?status=overdue');
    expect(portfolioHref('active', 'cur2')).toBe('/portfolio?status=active&cursor=cur2');
  });
});
