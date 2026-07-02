// Unit tests for the PURE buyer search-query + saved-set helpers. No React/native deps (the SDK type is type-only).
// Money is bigint paise (Law 2) — price filters convert via BigInt, never a float.
import { buildListingQuery, rupeesToPaiseFilter, activeFilterCount, describeSearch, activeFilterChips, removeFilterChip, cycleSort, SORT_KEYS } from '../../features/buyer/search-query';
import { toggleId, isSaved, capList, dedupeBy, upsertFront } from '../../features/buyer/saved-set';

describe('rupeesToPaiseFilter', () => {
  it('converts whole rupees to paise strings; lenient on empty/invalid', () => {
    expect(rupeesToPaiseFilter('100')).toBe('10000');
    expect(rupeesToPaiseFilter('0')).toBe('0');
    expect(rupeesToPaiseFilter('')).toBeUndefined();
    expect(rupeesToPaiseFilter('12.5')).toBeUndefined();
    expect(rupeesToPaiseFilter('abc')).toBeUndefined();
  });
  it('handles large caps without float loss', () => {
    expect(rupeesToPaiseFilter('999999999999')).toBe('99999999999900');
  });
});

describe('buildListingQuery', () => {
  it('drops empties, keeps a minimal query, defaults limit', () => {
    expect(buildListingQuery({})).toEqual({ limit: 20 });
  });
  it('trims text, maps organic/saleType, converts price bounds, omits default sort', () => {
    expect(buildListingQuery({ q: '  wheat ', saleType: 'auction', organic: true, priceMinRupees: '50', priceMaxRupees: '500', sort: 'newest' }))
      .toEqual({ limit: 20, q: 'wheat', saleType: 'auction', organic: true, priceMinMinor: '5000', priceMaxMinor: '50000' });
  });
  it('keeps a non-default sort and threads the cursor', () => {
    expect(buildListingQuery({ sort: 'price_desc' }, 'CUR', 30)).toEqual({ limit: 30, sort: 'price_desc', cursor: 'CUR' });
  });
  it('threads a single categoryId (screen 68 filter sheet)', () => {
    expect(buildListingQuery({ categoryId: 'cat-cereals' })).toEqual({ limit: 20, categoryId: 'cat-cereals' });
  });
});

describe('activeFilterCount / describeSearch', () => {
  it('counts only non-text, non-default-sort filters', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: 'rice' })).toBe(0); // text isn't a "filter"
    expect(activeFilterCount({ organic: true, saleType: 'direct', priceMinRupees: '10', sort: 'price_asc' })).toBe(4);
  });
  it('describes a search in a stable, human label', () => {
    expect(describeSearch({})).toBe('All produce');
    expect(describeSearch({ q: 'wheat', organic: true })).toContain('"wheat"');
    expect(describeSearch({ q: 'wheat', organic: true })).toContain('organic');
  });
});

describe('activeFilterChips / removeFilterChip (screen 67)', () => {
  it('emits chips for term + each active filter, in order, skipping empties', () => {
    expect(activeFilterChips({})).toEqual([]);
    expect(activeFilterChips({ q: '  wheat ', organic: true, saleType: 'auction', priceMinRupees: '50', priceMaxRupees: '3000' }))
      .toEqual([
        { key: 'q', value: 'wheat' },
        { key: 'organic' },
        { key: 'saleType', value: 'auction' },
        { key: 'priceMin', value: '50' },
        { key: 'priceMax', value: '3000' },
      ]);
  });
  it('ignores invalid price bounds (never a broken chip)', () => {
    expect(activeFilterChips({ priceMinRupees: '12.5', priceMaxRupees: 'abc' })).toEqual([]);
  });
  it('removeFilterChip clears exactly one filter, purely', () => {
    const form = { q: 'wheat', organic: true, saleType: 'auction', priceMinRupees: '50', priceMaxRupees: '3000' };
    expect(removeFilterChip(form, 'organic')).toMatchObject({ q: 'wheat', organic: false, saleType: 'auction' });
    expect(removeFilterChip(form, 'q')).toMatchObject({ q: '', organic: true });
    expect(removeFilterChip(form, 'priceMax').priceMaxRupees).toBeUndefined();
    expect(form.organic).toBe(true); // input untouched
  });
});

describe('cycleSort', () => {
  it('cycles through the supported sorts and wraps', () => {
    expect(SORT_KEYS).toEqual(['newest', 'price_asc', 'price_desc']);
    expect(cycleSort('newest')).toBe('price_asc');
    expect(cycleSort('price_asc')).toBe('price_desc');
    expect(cycleSort('price_desc')).toBe('newest');
    expect(cycleSort(undefined)).toBe('price_asc');
  });
});

describe('saved-set (pure)', () => {
  it('toggles ids to the front / removes', () => {
    expect(toggleId([], 'a')).toEqual(['a']);
    expect(toggleId(['b'], 'a')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
    expect(isSaved(['a'], 'a')).toBe(true);
  });
  it('caps the list to the most-recent N', () => {
    expect(capList([1, 2, 3, 4], 2)).toEqual([1, 2]);
    expect(capList([1], 5)).toEqual([1]);
  });
  it('dedupes by key keeping the first occurrence', () => {
    expect(dedupeBy([{ id: 'a' }, { id: 'b' }, { id: 'a' }], (x) => x.id)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
  it('upsertFront moves an existing item to the front, deduped + capped', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(upsertFront(list, { id: 'b' }, (x) => x.id, 10)).toEqual([{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
    expect(upsertFront(list, { id: 'd' }, (x) => x.id, 2)).toEqual([{ id: 'd' }, { id: 'a' }]);
  });
});
