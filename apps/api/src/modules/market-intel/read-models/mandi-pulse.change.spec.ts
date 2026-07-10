// Unit tests for the PURE day-over-day change helper on the mandi pulse read-model (P1-3). Float-free (BigInt).
import { dayOverDayChange } from './mandi-pulse.read-model';

describe('dayOverDayChange', () => {
  it('computes Δ vs the most recent strictly-earlier day (bps truncated)', () => {
    const r = dayOverDayChange([
      { priceDate: '2026-07-03', modalMinor: '210000' },
      { priceDate: '2026-07-02', modalMinor: '200000' },
      { priceDate: '2026-07-01', modalMinor: '190000' },
    ]);
    expect(r).toEqual({ previousModalMinor: '200000', previousDate: '2026-07-02', changeMinor: '10000', changeBps: 500 });
  });

  it('skips same-day rows to find the previous day', () => {
    const r = dayOverDayChange([
      { priceDate: '2026-07-03', modalMinor: '210000' },
      { priceDate: '2026-07-03', modalMinor: '205000' }, // same day (another yard)
      { priceDate: '2026-07-01', modalMinor: '150000' },
    ]);
    expect(r?.previousDate).toBe('2026-07-01');
    expect(r?.changeBps).toBe(4000); // (210000-150000)/150000*10000 = 4000
  });

  it('is negative when the price fell', () => {
    const r = dayOverDayChange([
      { priceDate: '2026-07-03', modalMinor: '180000' },
      { priceDate: '2026-07-02', modalMinor: '200000' },
    ]);
    expect(r?.changeBps).toBe(-1000);
    expect(r?.changeMinor).toBe('-20000');
  });

  it('returns null with <2 rows, no earlier day, or a zero previous', () => {
    expect(dayOverDayChange([])).toBeNull();
    expect(dayOverDayChange([{ priceDate: '2026-07-03', modalMinor: '210000' }])).toBeNull();
    expect(dayOverDayChange([
      { priceDate: '2026-07-03', modalMinor: '210000' },
      { priceDate: '2026-07-03', modalMinor: '205000' },
    ])).toBeNull();
    expect(dayOverDayChange([
      { priceDate: '2026-07-03', modalMinor: '210000' },
      { priceDate: '2026-07-02', modalMinor: '0' },
    ])).toBeNull();
  });
});
