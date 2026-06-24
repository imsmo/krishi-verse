// apps/web-admin/src/test/billing.spec.ts · unit tests for the pure billing helpers: invoice state machine
// gating + the money-safe (float-free) adjustment + dunning builders.
import { canTransition, isTerminal, canIssue, canMarkOverdue, canVoid, canDun, invoiceStatusKey, buildAdjustment, buildDunning } from '../features/billing/billing';

describe('invoice state machine (mirrors admin-api)', () => {
  it('admin-drivable action gating', () => {
    expect(canIssue('draft')).toBe(true);
    expect(canIssue('issued')).toBe(false);
    expect(canMarkOverdue('issued')).toBe(true);
    expect(canMarkOverdue('draft')).toBe(false);
    expect(canVoid('draft')).toBe(true);
    expect(canVoid('overdue')).toBe(true);
    expect(canVoid('paid')).toBe(false);
  });
  it('canDun while collectible', () => {
    expect(canDun('issued')).toBe(true);
    expect(canDun('overdue')).toBe(true);
    expect(canDun('draft')).toBe(false);
    expect(canDun('paid')).toBe(false);
  });
  it('transitions + terminal', () => {
    expect(canTransition('issued', 'paid')).toBe(true);
    expect(canTransition('paid', 'overdue')).toBe(false);
    expect(isTerminal('paid')).toBe(true);
    expect(isTerminal('void')).toBe(true);
    expect(isTerminal('issued')).toBe(false);
  });
  it('statusKey guards unknown', () => {
    expect(invoiceStatusKey('overdue')).toBe('overdue');
    expect(invoiceStatusKey('weird')).toBe('draft');
  });
});

const TID = '11111111-1111-4111-8111-111111111111';

describe('buildAdjustment (money-safe, float-free)', () => {
  it('assembles a credit with minor-unit string amount', () => {
    expect(buildAdjustment({ tenantId: TID, direction: 'credit', amountMinor: '50000', reason: 'goodwill credit' }))
      .toEqual({ ok: true, value: { tenantId: TID, direction: 'credit', amountMinor: '50000', currency: 'INR', reason: 'goodwill credit' } });
  });
  it('rejects floats / negative / non-digit amounts', () => {
    expect(buildAdjustment({ tenantId: TID, direction: 'debit', amountMinor: '500.50', reason: 'x y z' })).toEqual({ ok: false, error: 'amountMinor' });
    expect(buildAdjustment({ tenantId: TID, direction: 'debit', amountMinor: '-5', reason: 'x y z' })).toEqual({ ok: false, error: 'amountMinor' });
  });
  it('rejects bad tenant / direction / short reason', () => {
    expect(buildAdjustment({ tenantId: 'nope', direction: 'credit', amountMinor: '5', reason: 'x y z' })).toEqual({ ok: false, error: 'tenantId' });
    expect(buildAdjustment({ tenantId: TID, direction: 'sideways', amountMinor: '5', reason: 'x y z' })).toEqual({ ok: false, error: 'direction' });
    expect(buildAdjustment({ tenantId: TID, direction: 'credit', amountMinor: '5', reason: 'no' })).toEqual({ ok: false, error: 'reason' });
  });
});

describe('buildDunning', () => {
  it('accepts a channel + default outcome', () => {
    expect(buildDunning({ channel: 'email' })).toEqual({ ok: true, value: { channel: 'email', outcome: 'sent' } });
    expect(buildDunning({ channel: 'call', outcome: 'promised_pay', note: 'will pay Friday' })).toEqual({ ok: true, value: { channel: 'call', outcome: 'promised_pay', note: 'will pay Friday' } });
  });
  it('rejects a bad channel / outcome', () => {
    expect(buildDunning({ channel: 'pigeon' })).toEqual({ ok: false, error: 'channel' });
    expect(buildDunning({ channel: 'sms', outcome: 'maybe' })).toEqual({ ok: false, error: 'outcome' });
  });
});
