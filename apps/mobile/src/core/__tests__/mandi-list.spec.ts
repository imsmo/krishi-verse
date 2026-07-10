// Unit tests for the PURE mandi-list helpers (features/market/mandi-list). No React/SDK deps.
import { latestPriceDate, headerRegion, distinctCategories, filterByCategory } from '../../features/market/mandi-list';

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

describe('distinctCategories', () => {
  it('returns distinct non-empty categories sorted; ignores blanks/nulls', () => {
    expect(distinctCategories([
      { categoryName: 'Vegetables' }, { categoryName: 'Grains' }, { categoryName: 'Vegetables' },
      { categoryName: null }, { categoryName: '  ' }, {},
    ])).toEqual(['Grains', 'Vegetables']);
    expect(distinctCategories([])).toEqual([]);
  });
});

describe('filterByCategory', () => {
  const rows = [
    { id: 1, categoryName: 'Grains' }, { id: 2, categoryName: 'Vegetables' }, { id: 3, categoryName: null },
  ];
  it('"all" (or empty) returns every row', () => {
    expect(filterByCategory(rows, 'all')).toHaveLength(3);
    expect(filterByCategory(rows, '')).toHaveLength(3);
  });
  it('filters to the exact category name', () => {
    expect(filterByCategory(rows, 'Grains').map((r) => r.id)).toEqual([1]);
    expect(filterByCategory(rows, 'Spices')).toEqual([]);
  });
});
