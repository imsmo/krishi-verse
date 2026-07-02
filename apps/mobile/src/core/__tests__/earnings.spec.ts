// Unit tests for the PURE earnings-dashboard math (features/wallet/earnings). No React/SDK deps. Money is BigInt
// minor-unit strings (Law 2); the buckets mirror the server's WalletInsights.byMonth shape.
import { currentMonth, momDelta, totalSales, averageSaleMinor, bestMonth, periodTotal, barChart, earningsWindow, trailingAverageMinor, type Bucket } from '../../features/wallet/earnings';

const M: Bucket[] = [
  { key: '2026-03', amountMinor: '5200000', count: 9 },
  { key: '2026-04', amountMinor: '9100000', count: 13 },
  { key: '2026-05', amountMinor: '6100000', count: 10 },
  { key: '2026-06', amountMinor: '7400000', count: 12 },
  { key: '2026-07', amountMinor: '7200000', count: 11 },
  { key: '2026-08', amountMinor: '8432000', count: 14 },
];

describe('currentMonth / momDelta', () => {
  it('current = last bucket; MoM compares last two (Jul→Aug)', () => {
    expect(currentMonth(M)?.key).toBe('2026-08');
    const d = momDelta(M)!;
    expect(d.deltaMinor).toBe('1232000'); // 8432000 − 7200000
    expect(d.pct).toBe(17);               // +17%
  });
  it('null when <2 months or prior is 0', () => {
    expect(momDelta([M[0]])).toBeNull();
    expect(momDelta([{ key: 'a', amountMinor: '0', count: 0 }, { key: 'b', amountMinor: '500', count: 1 }])).toBeNull();
  });
});

describe('totalSales / averageSaleMinor', () => {
  it('sums counts and divides total by count (floored BigInt)', () => {
    const n = totalSales(M);
    expect(n).toBe(69);
    expect(averageSaleMinor('8432000', 14)).toBe('602285'); // floor(8432000/14)
    expect(averageSaleMinor('100', 0)).toBe('0');
  });
});

describe('bestMonth', () => {
  it('picks the highest-earning month (Apr ₹91k)', () => {
    expect(bestMonth(M)?.key).toBe('2026-04');
    expect(bestMonth([])).toBeNull();
  });
});

describe('periodTotal', () => {
  it('month = latest bucket; year = sum; lifetime/week flagged approximate', () => {
    expect(periodTotal(M, 'month')).toEqual({ amountMinor: '8432000', count: 14, approximate: false });
    const y = periodTotal(M, 'year');
    expect(y.amountMinor).toBe('43432000'); // sum of all six
    expect(y.count).toBe(69);
    expect(periodTotal(M, 'week').approximate).toBe(true);
    expect(periodTotal(M, 'lifetime').approximate).toBe(true);
  });
});

describe('barChart', () => {
  it('returns trailing 6 with normalized heights (Apr tallest = 100)', () => {
    const bars = barChart(M, 6);
    expect(bars).toHaveLength(6);
    expect(bars.find((b) => b.key === '2026-04')!.heightPct).toBe(100);
    expect(bars.every((b) => b.heightPct >= 0 && b.heightPct <= 100)).toBe(true);
  });
  it('all-zero amounts → 0 height (no divide-by-zero)', () => {
    expect(barChart([{ key: 'x', amountMinor: '0', count: 0 }])[0].heightPct).toBe(0);
  });
});

describe('trailingAverageMinor', () => {
  it('averages the trailing n months (floored BigInt)', () => {
    // sum of all six = 43432000 / 6 = 7238666 (floored)
    expect(trailingAverageMinor(M, 7)).toBe('7238666');
    // trailing 2 = (7200000+8432000)/2 = 7816000
    expect(trailingAverageMinor(M, 2)).toBe('7816000');
    expect(trailingAverageMinor([])).toBe('0');
  });
});

describe('earningsWindow', () => {
  it('produces a from<=to window per period', () => {
    const now = Date.UTC(2026, 7, 15);
    for (const p of ['week', 'month', 'year', 'lifetime'] as const) {
      const w = earningsWindow(p, now);
      expect(new Date(w.from!).getTime() <= new Date(w.to!).getTime()).toBe(true);
    }
  });
});
