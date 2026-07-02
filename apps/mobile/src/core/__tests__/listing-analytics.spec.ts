// Unit tests for the PURE listing-analytics helpers (screen 115): conv rate, real-stage funnel, day series.
import { convRate, funnelFromAnalytics, viewsByDaySeries } from '../../features/listings/listing-analytics';

describe('convRate', () => {
  it('computes offers ÷ views as a 1-dp percentage', () => {
    expect(convRate(3, 247)).toBe(1.2);
    expect(convRate(8, 247)).toBe(3.2);
    expect(convRate(1, 4)).toBe(25);
  });
  it('returns null with no views (no 0% / NaN leak)', () => {
    expect(convRate(0, 0)).toBeNull();
    expect(convRate(5, 0)).toBeNull();
    expect(convRate(2, -1)).toBeNull();
  });
});

describe('funnelFromAnalytics', () => {
  it('builds the real Opened→Saved→Offered stages (never fabricates a search-impression stage)', () => {
    const f = funnelFromAnalytics({ views: 247, saved: 42, offers: 3 });
    expect(f.map((s) => s.id)).toEqual(['opened', 'saved', 'offered']);
    expect(f[0]).toMatchObject({ value: 247, widthPct: 100 });
    expect(f[1].value).toBe(42);
    expect(f[2].value).toBe(3);
  });
  it('floors a non-zero stage to a visible width, keeps zero at zero', () => {
    const f = funnelFromAnalytics({ views: 1000, saved: 0, offers: 1 }); // 0.1% → floored up to 8
    expect(f[2].widthPct).toBe(8);
    expect(f[1].widthPct).toBe(0);
  });
  it('handles an empty/zero listing without dividing by zero', () => {
    const f = funnelFromAnalytics({ views: 0, saved: 0, offers: 0 });
    expect(f[0].widthPct).toBe(100);
    expect(f[2].widthPct).toBe(0);
  });
});

describe('viewsByDaySeries', () => {
  const today = Date.parse('2026-06-30T12:00:00Z'); // Tue
  it('always returns 7 ordered buckets ending today, filling gaps with 0', () => {
    const bars = viewsByDaySeries([{ day: '2026-06-30', views: 5 }, { day: '2026-06-28', views: 2 }], today);
    expect(bars.length).toBe(7);
    expect(bars[0].day).toBe('2026-06-24');
    expect(bars[6].day).toBe('2026-06-30');
    expect(bars[6].views).toBe(5);
    expect(bars[4].views).toBe(2);   // 06-28
    expect(bars[5].views).toBe(0);   // 06-29 absent → 0
  });
  it('scales bar heights to the busiest day (busiest=100, empty=0)', () => {
    const bars = viewsByDaySeries([{ day: '2026-06-30', views: 10 }, { day: '2026-06-29', views: 5 }], today);
    expect(bars[6].heightPct).toBe(100);
    expect(bars[5].heightPct).toBe(50);
    expect(bars[0].heightPct).toBe(0);
  });
  it('no views at all → all-zero heights, still 7 buckets (never NaN)', () => {
    const bars = viewsByDaySeries([], today);
    expect(bars.length).toBe(7);
    expect(bars.every((b) => b.views === 0 && b.heightPct === 0)).toBe(true);
  });
});
