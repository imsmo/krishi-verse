// Unit tests for the PURE mandi-list helpers (features/market/mandi-list). No React/SDK deps.
import { latestPriceDate, headerRegion, MANDI_CATEGORIES } from '../../features/market/mandi-list';

describe('latestPriceDate', () => {
  it('returns the most recent priceDate; null when empty', () => {
    expect(latestPriceDate([
      { priceDate: '2026-08-14T06:00:00Z' },
      { priceDate: '2026-08-15T05:30:00Z' },
      { priceDate: '2026-08-13T09:00:00Z' },
    ])).toBe('2026-08-15T05:30:00Z');
    expect(latestPriceDate([])).toBeNull();
  });
});

describe('headerRegion', () => {
  it('first non-empty region name, else null', () => {
    expect(headerRegion([{ priceDate: 'x', regionName: null }, { priceDate: 'x', regionName: 'Anand APMC' }])).toBe('Anand APMC');
    expect(headerRegion([{ priceDate: 'x', regionName: null }])).toBeNull();
  });
});

describe('MANDI_CATEGORIES', () => {
  it('starts with all + the five design categories', () => {
    expect(MANDI_CATEGORIES[0]).toBe('all');
    expect(MANDI_CATEGORIES).toHaveLength(6);
    expect(MANDI_CATEGORIES).toContain('spices');
  });
});
