// Unit tests for the pure payment money helpers (rupees→paise via BigInt, status → terminal outcome).
import { rupeesToPaiseMinor, paymentOutcome, isTerminal } from '../payments/money';

describe('rupeesToPaiseMinor', () => {
  it('converts whole rupees to paise (no float)', () => {
    expect(rupeesToPaiseMinor('1')).toBe('100');
    expect(rupeesToPaiseMinor('12450')).toBe('1245000');
  });
  it('rejects zero, negatives, non-integers, and over-cap', () => {
    expect(rupeesToPaiseMinor('0')).toBeNull();
    expect(rupeesToPaiseMinor('-5')).toBeNull();
    expect(rupeesToPaiseMinor('10.5')).toBeNull();
    expect(rupeesToPaiseMinor('abc')).toBeNull();
    expect(rupeesToPaiseMinor('999999999')).toBeNull(); // above default cap
  });
  it('respects a custom cap', () => {
    expect(rupeesToPaiseMinor('500', 100)).toBeNull();
    expect(rupeesToPaiseMinor('50', 100)).toBe('5000');
  });
});

describe('paymentOutcome / isTerminal', () => {
  it('classifies success statuses', () => {
    for (const s of ['captured', 'succeeded', 'paid', 'settled', 'SUCCESS']) expect(paymentOutcome(s)).toBe('success');
  });
  it('classifies failure statuses', () => {
    for (const s of ['failed', 'cancelled', 'expired', 'voided']) expect(paymentOutcome(s)).toBe('failed');
  });
  it('treats unknown/in-flight as pending', () => {
    for (const s of ['initiated', 'pending', 'authorized', undefined, '']) expect(paymentOutcome(s)).toBe('pending');
  });
  it('isTerminal only for success/failed', () => {
    expect(isTerminal('captured')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
  });
});
