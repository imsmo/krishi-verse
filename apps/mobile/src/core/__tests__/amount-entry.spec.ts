// Unit tests for the PURE money-entry helpers (screens 20 add-money / 70 withdraw).
import { maxWithdrawRupees, withdrawChipRupees, groupDigits, QUICK_ADD_RUPEES } from '../../features/wallet/amount-entry';

describe('maxWithdrawRupees', () => {
  it('floors paise → whole rupees', () => {
    expect(maxWithdrawRupees('1542050')).toBe(15420); // ₹15,420.50 → 15420
    expect(maxWithdrawRupees('100000')).toBe(1000);
  });
  it('0 for empty / non-positive / malformed (never throws)', () => {
    expect(maxWithdrawRupees('0')).toBe(0);
    expect(maxWithdrawRupees('-5')).toBe(0);
    expect(maxWithdrawRupees('nope')).toBe(0);
  });
});

describe('withdrawChipRupees', () => {
  it('keeps presets under balance + appends a Max chip', () => {
    const chips = withdrawChipRupees('1542050'); // max 15420
    expect(chips.map((c) => c.rupees)).toEqual([1000, 5000, 10000, 15420]);
    expect(chips[chips.length - 1].isMax).toBe(true);
  });
  it('drops presets ≥ balance', () => {
    const chips = withdrawChipRupees('600000'); // max 6000 → only 1000,5000 fit
    expect(chips.map((c) => c.rupees)).toEqual([1000, 5000, 6000]);
  });
  it('empty when balance is zero', () => {
    expect(withdrawChipRupees('0')).toEqual([]);
  });
});

describe('groupDigits', () => {
  it('groups a digit string for display (en)', () => {
    expect(groupDigits('5000', 'en')).toBe('5,000');
    expect(groupDigits('200000', 'en')).toBe('2,00,000'); // Indian grouping
  });
  it('strips junk + leading zeros; empty → 0', () => {
    expect(groupDigits('0a5b00', 'en')).toBe('500');
    expect(groupDigits('', 'en')).toBe('0');
  });
});

describe('QUICK_ADD_RUPEES', () => {
  it('matches the design chip row', () => {
    expect(QUICK_ADD_RUPEES).toEqual([500, 1000, 2000, 5000, 10000]);
  });
});
