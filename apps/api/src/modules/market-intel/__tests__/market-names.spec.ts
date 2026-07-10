// modules/market-intel/__tests__/market-names.spec.ts · pure name-merge helpers for the catalogue join (API-W11).
import { distinctIds, withNames } from '../read-models/market-names.read-model';

describe('distinctIds', () => {
  it('collects distinct non-null ids', () => {
    const rows = [{ p: 'a' }, { p: 'b' }, { p: 'a' }, { p: null }, { p: undefined }];
    expect(distinctIds(rows, (r) => r.p as any).sort()).toEqual(['a', 'b']);
  });
  it('returns [] for no ids', () => { expect(distinctIds([{ p: null }], (r) => r.p as any)).toEqual([]); });
});

describe('withNames', () => {
  // P1-3: NameMaps grew a `categories` map (productId → { categoryId, categoryName }) so a price row can also
  // carry its commodity category — see market-names.read-model.ts resolve()/categoryMap().
  const maps = { products: { p1: 'Tomato' }, grades: { g1: 'Grade A' }, regions: { r1: 'Gujarat' }, categories: { p1: { categoryId: 'cat1', categoryName: 'Vegetables' } } };
  it('attaches resolved names', () => {
    const out = withNames({ productId: 'p1', gradeOptionId: 'g1', regionId: 'r1', modalMinor: '500' } as any, maps);
    expect(out.productName).toBe('Tomato');
    expect(out.gradeName).toBe('Grade A');
    expect(out.regionName).toBe('Gujarat');
    expect((out as any).modalMinor).toBe('500');   // original fields preserved
  });
  it('attaches the product category (P1-3)', () => {
    const out = withNames({ productId: 'p1', gradeOptionId: 'g1', regionId: 'r1' } as any, maps);
    expect(out.categoryId).toBe('cat1');
    expect(out.categoryName).toBe('Vegetables');
  });
  it('null name for an unresolved or absent id (degrade, never throw)', () => {
    const out = withNames({ productId: 'unknown', gradeOptionId: null, regionId: undefined } as any, maps);
    expect(out.productName).toBeNull();
    expect(out.gradeName).toBeNull();
    expect(out.regionName).toBeNull();
    expect(out.categoryId).toBeNull();
    expect(out.categoryName).toBeNull();
  });
});
