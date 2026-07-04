// Unit tests for the PURE booking Confirm-&-Pay logic (features/labour/book-confirm) behind screen 63. Money is
// bigint paise; the breakdown is honest (real wage only; fee deferred; PMSBY free) — no fabricated total.
import { walletSufficient, confirmFeeLines, committedWageMinor, canConfirm, PAYMENT_METHODS } from '../../features/labour/book-confirm';

describe('walletSufficient (bigint, no float)', () => {
  it('true only when available ≥ required', () => {
    expect(walletSufficient('284000', '40000')).toBe(true);
    expect(walletSufficient('40000', '40000')).toBe(true);
    expect(walletSufficient('39999', '40000')).toBe(false);
  });
  it('false on missing/blank/garbage balance (never claims what it cannot prove)', () => {
    expect(walletSufficient(null, '40000')).toBe(false);
    expect(walletSufficient('', '40000')).toBe(false);
    expect(walletSufficient('abc', '40000')).toBe(false);
    expect(walletSufficient('40000', null)).toBe(false);
  });
});

describe('confirmFeeLines', () => {
  it('is wage(amount) → platformFee(settlement) → pmsby(free), only wage carries a figure', () => {
    const lines = confirmFeeLines('40000');
    expect(lines.map((l) => l.key)).toEqual(['wage', 'platformFee', 'pmsby']);
    expect(lines[0]).toMatchObject({ kind: 'amount', minor: '40000' });
    expect(lines[1]).toMatchObject({ key: 'platformFee', kind: 'settlement' });
    expect(lines[1].minor).toBeUndefined(); // never a fabricated ₹10
    expect(lines[2]).toMatchObject({ key: 'pmsby', kind: 'free' });
  });
  it('defends against a non-numeric wage', () => {
    expect(confirmFeeLines('₹400')[0].minor).toBe('0');
  });
});

describe('committedWageMinor', () => {
  it('returns the wage paise (the amount owed the worker), 0 on garbage', () => {
    expect(committedWageMinor('40000')).toBe('40000');
    expect(committedWageMinor('x')).toBe('0');
  });
});

describe('canConfirm', () => {
  it('needs a draft + agreement + a valid method', () => {
    expect(canConfirm(true, true, 'wallet')).toBe(true);
    expect(canConfirm(true, true, 'upi')).toBe(true);
    expect(canConfirm(false, true, 'wallet')).toBe(false);
    expect(canConfirm(true, false, 'wallet')).toBe(false);
    expect(canConfirm(true, true, null)).toBe(false);
  });
  it('exposes both methods', () => {
    expect(PAYMENT_METHODS).toEqual(['wallet', 'upi']);
  });
});
