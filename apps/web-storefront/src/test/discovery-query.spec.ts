// apps/web-storefront/src/test/discovery-query.spec.ts · the storefront's money + filter math. The whole point is
// that money is integer-string arithmetic (Law 2) — these tests pin that there is NO float drift and that a bad
// filter is dropped rather than trusted.
import {
  parseMajorToMinor, minorToMajor, toListingQuery, buildQueryString, activeFilters, loadMoreHref, hasActiveFilters,
} from '../features/discovery/query';

describe('parseMajorToMinor (major decimal → minor integer string, no float)', () => {
  it('whole rupees → paise', () => { expect(parseMajorToMinor('99')).toBe('9900'); });
  it('one decimal place pads to two', () => { expect(parseMajorToMinor('123.4')).toBe('12340'); });
  it('two decimal places', () => { expect(parseMajorToMinor('123.45')).toBe('12345'); });
  it('strips leading zeros but keeps a value', () => { expect(parseMajorToMinor('0.05')).toBe('5'); });
  it('huge values keep full precision (no Number rounding)', () => {
    expect(parseMajorToMinor('99999999999')).toBe('9999999999900');
  });
  it('rejects junk / 3dp / negatives → undefined', () => {
    expect(parseMajorToMinor('abc')).toBeUndefined();
    expect(parseMajorToMinor('1.234')).toBeUndefined();
    expect(parseMajorToMinor('-5')).toBeUndefined();
    expect(parseMajorToMinor('')).toBeUndefined();
    expect(parseMajorToMinor(undefined)).toBeUndefined();
  });
  it('round-trips with minorToMajor', () => {
    expect(minorToMajor(parseMajorToMinor('123.40'))).toBe('123.40');
    expect(minorToMajor('9900')).toBe('99');
    expect(minorToMajor('5')).toBe('0.05');
    expect(minorToMajor(undefined)).toBe('');
  });
});

describe('toListingQuery (validate + drop untrusted values)', () => {
  it('passes through known facets + price band as minor strings', () => {
    const q = toListingQuery({ q: 'rice', saleType: 'auction', sort: 'price_asc', organic: '1', priceMin: '10', priceMax: '50', categoryId: 'c1', regionId: 'r1' });
    expect(q).toMatchObject({ q: 'rice', saleType: 'auction', sort: 'price_asc', organic: true, priceMinMinor: '1000', priceMaxMinor: '5000', categoryId: 'c1', regionId: 'r1', limit: 24 });
  });
  it('drops unrecognised enum values (anti-injection of filters)', () => {
    const q = toListingQuery({ saleType: 'bogus', sort: 'cheapest' });
    expect(q.saleType).toBeUndefined();
    expect(q.sort).toBeUndefined();
  });
  it('organic only true when exactly "1"', () => {
    expect(toListingQuery({ organic: 'true' }).organic).toBeUndefined();
    expect(toListingQuery({ organic: '1' }).organic).toBe(true);
  });
});

describe('query-string helpers', () => {
  it('builds a stable, empty-free query string', () => {
    expect(buildQueryString({ q: 'rice', cursor: '', sort: undefined })).toBe('?q=rice');
    expect(buildQueryString({})).toBe('');
  });
  it('activeFilters omits the cursor; loadMoreHref preserves filters + advances cursor', () => {
    const sp = { q: 'rice', saleType: 'direct', cursor: 'OLD' };
    expect(activeFilters(sp)).toEqual({ q: 'rice', saleType: 'direct' });
    expect(loadMoreHref('/acme', sp, 'NEXT')).toBe('/acme?q=rice&saleType=direct&cursor=NEXT');
    expect(hasActiveFilters(sp)).toBe(true);
    expect(hasActiveFilters({ cursor: 'x' })).toBe(false);
  });
});
