// Unit tests for the PURE spending-insights helpers (features/wallet/spending, screen 182). No React/native deps.
import { categoryBreakdown, spendingIcon } from '../../features/wallet/spending';
import type { Bucket } from '../../features/wallet/earnings';

const b = (key: string, amountMinor: string, count = 1): Bucket => ({ key, amountMinor, count });

describe('categoryBreakdown', () => {
  it('sorts high→low and computes integer % of total', () => {
    const byType = [b('transport', '45000'), b('worker_wage', '160000'), b('input', '82000')];
    expect(categoryBreakdown(byType, '318000')).toEqual([
      { key: 'worker_wage', amountMinor: '160000', pct: 50 },
      { key: 'input', amountMinor: '82000', pct: 25 },
      { key: 'transport', amountMinor: '45000', pct: 14 },
    ]);
  });
  it('0% when total is zero / empty / null', () => {
    expect(categoryBreakdown([b('x', '100')], '0')).toEqual([{ key: 'x', amountMinor: '100', pct: 0 }]);
    expect(categoryBreakdown([], '100')).toEqual([]);
    expect(categoryBreakdown(null as unknown as Bucket[], '100')).toEqual([]);
  });
  it('uses BigInt (no float precision loss on large amounts)', () => {
    const r = categoryBreakdown([b('a', '9007199254740993000')], '9007199254740993000');
    expect(r[0].pct).toBe(100);
  });
});

describe('spendingIcon', () => {
  it('matches known category codes', () => {
    expect(spendingIcon('worker_wage')).toBe('👷');
    expect(spendingIcon('labour_payment')).toBe('👷');
    expect(spendingIcon('input_purchase')).toBe('💊');
    expect(spendingIcon('transport_fee')).toBe('🚛');
    expect(spendingIcon('listing_boost')).toBe('🚀');
  });
  it('falls back to the generic icon', () => {
    expect(spendingIcon('something_else')).toBe('📋');
    expect(spendingIcon('')).toBe('📋');
    expect(spendingIcon(null)).toBe('📋');
  });
});
