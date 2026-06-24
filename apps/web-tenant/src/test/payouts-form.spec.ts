// apps/web-tenant/src/test/payouts-form.spec.ts · unit tests for the payouts helpers. Money parsing is Law-2
// (float-free) and the bank-add validator must reject anything but a tokenised vaultRef + well-formed display
// fields (no raw account numbers), so its accept/reject behaviour is worth pinning.
import { buildPayoutRequest, buildBankAccount, bankLabel } from '../features/payouts/form';

describe('buildPayoutRequest', () => {
  it('assembles a valid request (amount → minor string)', () => {
    const r = buildPayoutRequest({ amountMajor: '1500.50', bankAccountId: 'ba1' });
    expect(r).toEqual({ ok: true, value: { amountMinor: '150050', bankAccountId: 'ba1', currencyCode: 'INR' } });
  });
  it('rejects missing account / bad amount', () => {
    expect(buildPayoutRequest({ amountMajor: '100', bankAccountId: '' })).toEqual({ ok: false, error: 'account' });
    expect(buildPayoutRequest({ amountMajor: '0', bankAccountId: 'ba1' })).toEqual({ ok: false, error: 'amount' });
    expect(buildPayoutRequest({ amountMajor: 'x', bankAccountId: 'ba1' })).toEqual({ ok: false, error: 'amount' });
  });
});

describe('buildBankAccount', () => {
  it('accepts a UPI destination with vaultRef + upiId', () => {
    const r = buildBankAccount({ accountKind: 'upi', vaultRef: 'fa_123', upiId: 'farm@okaxis' });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toMatchObject({ accountKind: 'upi', vaultRef: 'fa_123', upiId: 'farm@okaxis' });
  });
  it('accepts a bank destination with vaultRef + ifsc + last4', () => {
    const r = buildBankAccount({ accountKind: 'bank', vaultRef: 'fa_9', ifsc: 'hdfc0001234', accountLast4: '4321', isPrimary: 'on' });
    expect(r.ok && r.value).toMatchObject({ accountKind: 'bank', ifsc: 'HDFC0001234', accountLast4: '4321', isPrimary: true });
  });
  it('rejects missing vaultRef / bad kind / bad upi / bad ifsc', () => {
    expect(buildBankAccount({ accountKind: 'bank', vaultRef: '' })).toEqual({ ok: false, error: 'vaultRef' });
    expect(buildBankAccount({ accountKind: 'x', vaultRef: 'fa' })).toEqual({ ok: false, error: 'kind' });
    expect(buildBankAccount({ accountKind: 'upi', vaultRef: 'fa', upiId: 'nope' })).toEqual({ ok: false, error: 'upi' });
    expect(buildBankAccount({ accountKind: 'bank', vaultRef: 'fa', ifsc: 'BAD', accountLast4: '12' })).toEqual({ ok: false, error: 'bank' });
  });
});

describe('bankLabel', () => {
  it('masks to last-4 / VPA only', () => {
    expect(bankLabel({ id: '1', accountKind: 'upi', upiId: 'farm@ok', isPrimary: true })).toBe('farm@ok');
    expect(bankLabel({ id: '2', accountKind: 'bank', accountLast4: '4321', ifsc: 'HDFC0001234', isPrimary: false })).toBe('••••4321 · HDFC0001234');
  });
});
