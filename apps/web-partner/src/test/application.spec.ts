// apps/web-partner/src/test/application.spec.ts · unit tests for the pure lender loan-application helpers.
import {
  APP_STATUSES, isAppStatus, canTransition, isTerminal, canReview, canApprove, canReject, canDisburse,
  statusKey, statusTone, rupeesToPaiseMinor, buildApprove, buildReject, LendingError,
  LENDER_BOXES, isLenderBox, boxKey, buildListQuery, queueHref,
} from '../features/lending/application';

describe('loan-application state machine', () => {
  it('has the seven statuses', () => {
    expect(APP_STATUSES).toEqual(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'disbursed']);
  });
  it('mirrors the API transitions', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true);
    expect(canTransition('under_review', 'approved')).toBe(true);
    expect(canTransition('under_review', 'rejected')).toBe(true);
    expect(canTransition('approved', 'disbursed')).toBe(true);
    expect(canTransition('submitted', 'approved')).toBe(false);
    expect(canTransition('disbursed', 'approved')).toBe(false);
  });
  it('terminal + status guards', () => {
    expect(isTerminal('disbursed')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('under_review')).toBe(false);
    expect(canReview('submitted')).toBe(true);
    expect(canReview('under_review')).toBe(false);
    expect(canApprove('under_review')).toBe(true);
    expect(canReject('under_review')).toBe(true);
    expect(canDisburse('approved')).toBe(true);
    expect(canDisburse('under_review')).toBe(false);
  });
  it('status key + tone', () => {
    expect(isAppStatus('approved')).toBe(true);
    expect(isAppStatus('nope')).toBe(false);
    expect(statusKey('approved')).toBe('loan.st.approved');
    expect(statusKey('nope')).toBe('loan.st.unknown');
    expect(statusTone('approved')).toBe('ok');
    expect(statusTone('submitted')).toBe('warn');
    expect(statusTone('under_review')).toBe('info');
    expect(statusTone('rejected')).toBe('danger');
  });
});

describe('money: ₹ → paise (BigInt, float-free)', () => {
  it('converts whole rupees to paise minor units', () => {
    expect(rupeesToPaiseMinor('100')).toBe('10000');
    expect(rupeesToPaiseMinor('0')).toBe('0');
    expect(rupeesToPaiseMinor('9999999999999')).toBe('999999999999900');
  });
  it('rejects non-digit / float / oversized input', () => {
    expect(() => rupeesToPaiseMinor('1.5')).toThrow(LendingError);
    expect(() => rupeesToPaiseMinor('-1')).toThrow();
    expect(() => rupeesToPaiseMinor('')).toThrow();
    expect(() => rupeesToPaiseMinor('99999999999999')).toThrow(); // 14 digits
  });
});

describe('builders', () => {
  it('approve: amount → paise + cooling-off default/validate', () => {
    expect(buildApprove('500', undefined)).toEqual({ amountApprovedMinor: '50000', coolingOffHours: 24 });
    expect(buildApprove('500', '0')).toEqual({ amountApprovedMinor: '50000', coolingOffHours: 0 });
    expect(buildApprove('500', '48')).toEqual({ amountApprovedMinor: '50000', coolingOffHours: 48 });
    expect(() => buildApprove('500', '721')).toThrow(LendingError);
    expect(() => buildApprove('bad', '24')).toThrow();
  });
  it('reject: optional note ≤ 500', () => {
    expect(buildReject(undefined)).toEqual({});
    expect(buildReject('  ')).toEqual({});
    expect(buildReject('incomplete KYC')).toEqual({ note: 'incomplete KYC' });
    expect(() => buildReject('x'.repeat(501))).toThrow();
  });
});

describe('queue filters', () => {
  it('lender boxes + keys', () => {
    expect(LENDER_BOXES).toEqual(['review', 'all']);
    expect(isLenderBox('review')).toBe(true);
    expect(isLenderBox('all')).toBe(true);
    expect(isLenderBox('mine')).toBe(false);
    expect(isLenderBox(undefined)).toBe(false);
    expect(boxKey('review')).toBe('loan.box.review');
  });
  it('buildListQuery normalises box/status/cursor', () => {
    expect(buildListQuery({})).toEqual({ box: 'review', status: undefined, cursor: undefined, limit: 50 });
    expect(buildListQuery({ box: 'all', status: 'approved', cursor: 'c1' })).toEqual({ box: 'all', status: 'approved', cursor: 'c1', limit: 50 });
    expect(buildListQuery({ box: 'mine', status: 'nope', cursor: '  ' })).toEqual({ box: 'review', status: undefined, cursor: undefined, limit: 50 });
  });
  it('queueHref preserves filters, omits default box', () => {
    expect(queueHref('review')).toBe('/loan-queue');
    expect(queueHref('all')).toBe('/loan-queue?box=all');
    expect(queueHref('review', 'under_review')).toBe('/loan-queue?status=under_review');
    expect(queueHref('all', 'approved', 'cur2')).toBe('/loan-queue?box=all&status=approved&cursor=cur2');
  });
});
