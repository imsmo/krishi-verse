// Unit tests for the PURE add-bank helpers (features/kyc/bank-setup, screen 74). No React/native deps.
// The raw account number never leaves component state except to the server tokenise endpoint; these helpers only
// normalise + validate for UX (the server + penny-drop are the real authority).
import { isValidIfsc, normalizeIfsc, normalizeAccountNumber, isValidAccountNumber, validateBankForm } from '../../features/kyc/bank-setup';

describe('IFSC', () => {
  it('accepts a well-formed IFSC (4 letters + 0 + 6 alnum)', () => {
    expect(isValidIfsc('SBIN0001247')).toBe(true);
    expect(isValidIfsc('hdfc0abc123')).toBe(true); // case-insensitive
  });
  it('rejects malformed IFSC', () => {
    expect(isValidIfsc('SBIN1001247')).toBe(false); // 5th char not 0
    expect(isValidIfsc('SBI0001247')).toBe(false);  // too short
    expect(isValidIfsc('')).toBe(false);
  });
  it('normalizes spaces + case, caps at 11', () => {
    expect(normalizeIfsc('sbin 0001 247')).toBe('SBIN0001247');
    expect(normalizeIfsc('sbin0001247extra')).toBe('SBIN0001247');
  });
});

describe('account number', () => {
  it('keeps digits only, capped at 18', () => {
    expect(normalizeAccountNumber('1234-5678 90')).toBe('1234567890');
    expect(normalizeAccountNumber('1'.repeat(25))).toBe('1'.repeat(18));
  });
  it('valid at 9–18 digits', () => {
    expect(isValidAccountNumber('123456789')).toBe(true);
    expect(isValidAccountNumber('12345678')).toBe(false); // 8
    expect(isValidAccountNumber('1'.repeat(18))).toBe(true);
  });
});

describe('validateBankForm', () => {
  const good = { holderName: 'Ramesh Patel', accountNumber: '123456789012', confirmAccountNumber: '123456789012', ifsc: 'sbin0001247', accountType: 'savings' as const };
  it('accepts a complete valid form and builds a normalised payload', () => {
    expect(validateBankForm(good)).toEqual({ ok: true, input: { accountNumber: '123456789012', ifsc: 'SBIN0001247', holderName: 'Ramesh Patel', accountType: 'savings' } });
  });
  it('defaults account type to savings when unset', () => {
    const r = validateBankForm({ ...good, accountType: undefined });
    expect(r.ok && r.input.accountType).toBe('savings');
  });
  it('flags each failure in read order', () => {
    expect(validateBankForm({ ...good, holderName: 'R' })).toEqual({ ok: false, reason: 'name' });
    expect(validateBankForm({ ...good, accountNumber: '123', confirmAccountNumber: '123' })).toEqual({ ok: false, reason: 'account' });
    expect(validateBankForm({ ...good, confirmAccountNumber: '999999999999' })).toEqual({ ok: false, reason: 'mismatch' });
    expect(validateBankForm({ ...good, ifsc: 'BAD' })).toEqual({ ok: false, reason: 'ifsc' });
  });
});
