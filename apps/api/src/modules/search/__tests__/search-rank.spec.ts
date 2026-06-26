// modules/search/__tests__/search-rank.spec.ts · pure merge/rank + cursor codec (no I/O).
import { parseTypes, clampLimit, titleMatchScore, rankHits, encodeSearchCursor, decodeSearchCursor, SEARCH_TYPES } from '../domain/search.rank';

describe('search/rank — parseTypes', () => {
  it('defaults to all on empty/invalid, intersects valid', () => {
    expect(parseTypes(undefined)).toEqual([...SEARCH_TYPES]);
    expect(parseTypes('  ')).toEqual([...SEARCH_TYPES]);
    expect(parseTypes('listings')).toEqual(['listings']);
    expect(parseTypes('products,listings')).toEqual(['listings', 'products']); // preserves SEARCH_TYPES order
    expect(parseTypes('bogus')).toEqual([...SEARCH_TYPES]);
  });
});

describe('search/rank — clampLimit + titleMatchScore', () => {
  it('clamps to [1,50] with default', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(999)).toBe(50);
    expect(clampLimit(7)).toBe(7);
  });
  it('scores exact > prefix > substring > none (case/space-insensitive)', () => {
    expect(titleMatchScore('Tomato', 'tomato')).toBe(3);
    expect(titleMatchScore('Tomato seeds', 'tomato')).toBe(2);
    expect(titleMatchScore('ripe tomato lot', 'tomato')).toBe(1);
    expect(titleMatchScore('wheat', 'tomato')).toBe(0);
    expect(titleMatchScore('x', '')).toBe(0);
  });
});

describe('search/rank — rankHits', () => {
  it('orders by match strength, then recency, caps to limit', () => {
    const groups = [
      { type: 'listings' as const, hits: [
        { type: 'listings' as const, id: 'l1', title: 'tomato', createdAt: '2026-06-01T00:00:00.000Z' },        // exact (3)
        { type: 'listings' as const, id: 'l2', title: 'old tomato lot', createdAt: '2026-06-20T00:00:00.000Z' }, // substring (1), newer
      ] },
      { type: 'products' as const, hits: [
        { type: 'products' as const, id: 'p1', title: 'tomato hybrid', createdAt: '2026-06-10T00:00:00.000Z' },  // prefix (2)
      ] },
    ];
    const out = rankHits(groups, 'tomato', 10);
    expect(out.map((h) => h.id)).toEqual(['l1', 'p1', 'l2']);   // 3 > 2 > 1
    expect(rankHits(groups, 'tomato', 2).length).toBe(2);
  });
  it('within equal score, newer first', () => {
    const groups = [{ type: 'listings' as const, hits: [
      { type: 'listings' as const, id: 'a', title: 'rice basmati', createdAt: '2026-01-01T00:00:00.000Z' },
      { type: 'listings' as const, id: 'b', title: 'rice sona', createdAt: '2026-09-01T00:00:00.000Z' },
    ] }];
    expect(rankHits(groups, 'rice', 10).map((h) => h.id)).toEqual(['b', 'a']);
  });
});

describe('search/rank — federated cursor codec', () => {
  it('round-trips a per-type cursor map, drops empties, defends against junk', () => {
    const c = encodeSearchCursor({ listings: 'L1', products: 'P1' })!;
    expect(decodeSearchCursor(c)).toEqual({ listings: 'L1', products: 'P1' });
    expect(encodeSearchCursor({})).toBeUndefined();
    expect(encodeSearchCursor({ listings: undefined })).toBeUndefined();
    expect(decodeSearchCursor(undefined)).toEqual({});
    expect(decodeSearchCursor('!!not base64!!')).toEqual({});
  });
});
