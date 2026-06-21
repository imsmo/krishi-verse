// Unit tests for the PURE wallet presenters + the withdrawal guard (features/wallet/txn). No React/native deps
// (SDK/ui imports are type-only). Money is bigint minor units (Law 2) — the guard must use BigInt, never float.
import { statusTone, statusLabelKey, txnTitleKey, presentPayment, presentPayout, withdrawable } from '../../features/wallet/txn';
import type { PaymentSummary, PayoutSummary } from '@krishi-verse/sdk-js';

describe('statusTone / statusLabelKey', () => {
  it('maps terminal/non-terminal statuses to tone + label key', () => {
    expect(statusTone('captured')).toBe('success');
    expect(statusTone('failed')).toBe('danger');
    expect(statusTone('created')).toBe('warning'); // pending
    expect(statusLabelKey('settled')).toBe('success');
    expect(statusLabelKey('cancelled')).toBe('failed');
    expect(statusLabelKey(undefined)).toBe('pending');
  });
});

describe('txnTitleKey', () => {
  it('derives the title key from kind + purpose only', () => {
    expect(txnTitleKey({ kind: 'payout' })).toBe('withdrawal');
    expect(txnTitleKey({ kind: 'payment', purpose: 'wallet_recharge' })).toBe('recharge');
    expect(txnTitleKey({ kind: 'payment', purpose: 'direct_order' })).toBe('payment');
    expect(txnTitleKey({ kind: 'payment' })).toBe('payment');
  });
});

describe('presentPayment / presentPayout', () => {
  it('a wallet recharge is a positive (credit) payment', () => {
    const p: PaymentSummary = { id: 'p1', status: 'captured', amountMinor: '500000', currencyCode: 'INR', purpose: 'wallet_recharge', createdAt: '2026-06-01T00:00:00Z' };
    const v = presentPayment(p);
    expect(v).toMatchObject({ id: 'p1', kind: 'payment', amountMinor: '500000', moneyTone: 'positive', tone: 'success' });
  });
  it('a non-recharge payment is neutral (we never assert it touched the wallet)', () => {
    const p: PaymentSummary = { id: 'p2', status: 'created', amountMinor: '100', currencyCode: 'INR', purpose: 'direct_order' };
    expect(presentPayment(p).moneyTone).toBe('default');
  });
  it('a payout is always a negative (debit) movement', () => {
    const p: PayoutSummary = { id: 'o1', status: 'processing', amountMinor: '250000', currencyCode: 'INR' };
    const v = presentPayout(p);
    expect(v).toMatchObject({ id: 'o1', kind: 'payout', moneyTone: 'negative', tone: 'warning' });
  });
  it('defaults missing amount to 0 (never undefined into MoneyText)', () => {
    expect(presentPayment({ id: 'p3', status: 'captured' } as PaymentSummary).amountMinor).toBe('0');
  });
});

describe('withdrawable (BigInt guard — Law 2)', () => {
  it('allows a positive amount up to the balance', () => {
    expect(withdrawable('100000', '100000')).toEqual({ ok: true });
    expect(withdrawable('100000', '1')).toEqual({ ok: true });
  });
  it('rejects amounts over the reconciled balance', () => {
    expect(withdrawable('100000', '100001')).toEqual({ ok: false, reason: 'exceeds' });
  });
  it('rejects zero / negative / unparseable amounts', () => {
    expect(withdrawable('100000', '0')).toEqual({ ok: false, reason: 'invalid' });
    expect(withdrawable('100000', '-5')).toEqual({ ok: false, reason: 'invalid' });
    expect(withdrawable('100000', null)).toEqual({ ok: false, reason: 'invalid' });
    expect(withdrawable('100000', 'abc')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('handles very large balances without float precision loss', () => {
    const huge = '9007199254740993000'; // > 2^53
    expect(withdrawable(huge, huge)).toEqual({ ok: true });
    expect(withdrawable(huge, '9007199254740993001')).toEqual({ ok: false, reason: 'exceeds' });
  });
});
