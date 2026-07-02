// Unit tests for the PURE commodity-detail helpers (features/market/mandi-detail). No React/SDK deps. Money is
// BigInt minor-unit strings (Law 2). History rows mirror the server's MandiPrice shape (priceDate + modalMinor).
import { sortedDesc, previousModalMinor, priceChange, summaryStats, trendSeries, nearbyMandiPrices, bestNearby, TREND_PERIODS, modalOnOrBefore, trendByDays } from '../../features/market/mandi-detail';

const NOW = Date.UTC(2026, 7, 15);
function daysAgo(n: number) { return new Date(NOW - n * 86_400_000).toISOString(); }
const H = [
  { priceDate: daysAgo(0), modalMinor: '288000' },  // ₹2,880 today
  { priceDate: daysAgo(1), modalMinor: '281200' },  // ₹2,812 prev
  { priceDate: daysAgo(10), modalMinor: '264000' }, // ₹2,640 low
  { priceDate: daysAgo(20), modalMinor: '292000' }, // ₹2,920 high
  { priceDate: daysAgo(120), modalMinor: '250000' },// outside 30d / 90d
];

describe('priceChange (day-over-day)', () => {
  it('latest vs prior day → +₹68 (2.4%)', () => {
    const prev = previousModalMinor(H, H[0].priceDate);
    expect(prev).toBe('281200');
    const c = priceChange('288000', prev)!;
    expect(c.deltaMinor).toBe('6800'); // ₹68
    expect(c.pct).toBe(2);             // floor(6800*100/281200)
  });
  it('null when no prior price', () => {
    expect(priceChange('288000', null)).toBeNull();
  });
});

describe('summaryStats (30-day)', () => {
  it('high/low/avg over the window + a volatility bucket', () => {
    const s = summaryStats(H, 30, NOW);
    expect(s.highMinor).toBe('292000');
    expect(s.lowMinor).toBe('264000');
    expect(s.count).toBe(4);            // the 120-day-old row is excluded
    expect(['low', 'medium', 'high']).toContain(s.volatility);
  });
  it('empty → zeros + low', () => {
    expect(summaryStats([], 30, NOW)).toEqual({ highMinor: '0', lowMinor: '0', avgMinor: '0', volatility: 'low', count: 0 });
  });
});

describe('trendSeries', () => {
  it('windows history + normalizes heights (tallest 100), oldest→newest', () => {
    const bars = trendSeries(H, '1M', NOW);
    expect(bars.length).toBe(4); // excludes 120-day row
    expect(Math.max(...bars.map((b) => b.heightPct))).toBe(100);
    expect(new Date(bars[0].dateIso).getTime() < new Date(bars[bars.length - 1].dateIso).getTime()).toBe(true);
  });
  it('exposes the 5 design periods', () => {
    expect(TREND_PERIODS).toEqual(['1W', '1M', '3M', '6M', '1Y']);
  });
});

describe('nearbyMandiPrices / bestNearby', () => {
  const prices = [
    { mandiId: 'm-anand', modalMinor: '288000' },
    { mandiId: 'm-vad', modalMinor: '291000' },
    { mandiId: 'm-orphan', modalMinor: '999999' }, // no meta → dropped
    { mandiId: null, modalMinor: '1' },            // no id → dropped
  ];
  const mandis = [
    { id: 'm-anand', name: 'Anand APMC', distanceKm: 0 },
    { id: 'm-vad', name: 'Vadodara APMC', distanceKm: 42 },
  ];
  it('joins + sorts nearest-first, drops unresolved', () => {
    const rows = nearbyMandiPrices(prices, mandis);
    expect(rows.map((r) => r.mandiId)).toEqual(['m-anand', 'm-vad']);
  });
  it('best = highest price (seller-favourable)', () => {
    expect(bestNearby(nearbyMandiPrices(prices, mandis))!.name).toBe('Vadodara APMC');
    expect(bestNearby([])).toBeNull();
  });
});

describe('modalOnOrBefore (period-over-period)', () => {
  it('price ~7 days ago drives the week change', () => {
    // 10-day-ago row (264000) is the most recent on/before (now − 7d)
    expect(modalOnOrBefore(H, NOW - 7 * 86_400_000)).toBe('264000');
    expect(modalOnOrBefore(H, NOW - 100 * 86_400_000)).toBe('250000'); // only the 120-day row is on/before now−100d
    expect(modalOnOrBefore(H, NOW - 5000 * 86_400_000)).toBeNull();
  });
});

describe('trendByDays', () => {
  it('day-windowed bars, normalized, oldest→newest', () => {
    const bars = trendByDays(H, 30, NOW);
    expect(bars.length).toBe(4); // excludes the 120-day row
    expect(Math.max(...bars.map((b) => b.heightPct))).toBe(100);
  });
  it('5-year window includes everything', () => {
    expect(trendByDays(H, 1825, NOW).length).toBe(5);
  });
});

describe('sortedDesc', () => {
  it('newest first, non-mutating', () => {
    const out = sortedDesc(H);
    expect(new Date(out[0].priceDate).getTime() >= new Date(out[1].priceDate).getTime()).toBe(true);
    expect(H[0].priceDate).toBe(daysAgo(0));
  });
});
