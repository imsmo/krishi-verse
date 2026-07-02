// Unit tests for the PURE create-listing logic (screen 10): money conversion + draft assembly. No I/O.
import { rupeesToPaise, parseQty, buildCreateDraft, CREATE_MODES, QUALITY_GRADES, type ListingDraftForm } from '../../features/listings/create-listing';

const base: ListingDraftForm = { productId: 'p1', categoryId: 'c1', title: 'Wheat', defaultUnit: 'qtl', qty: '5', rupees: '2800' };

describe('money + qty parsing', () => {
  it('rupees→paise as a bigint-minor string (Law 2, never float)', () => {
    expect(rupeesToPaise('2800')).toBe('280000');
    expect(rupeesToPaise('1')).toBe('100');
    expect(rupeesToPaise('0')).toBe('0');
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise('28.5')).toBeNull();   // no floats
    expect(rupeesToPaise('-5')).toBeNull();
    expect(rupeesToPaise('12345678901234')).toBeNull(); // >13 digits
  });
  it('qty must be a positive integer ≤ 7 digits', () => {
    expect(parseQty('5')).toBe(5);
    expect(parseQty('0')).toBeNull();
    expect(parseQty('5.5')).toBeNull();
    expect(parseQty('12345678')).toBeNull();
  });
  it('modes + grades are the design set', () => {
    expect([...CREATE_MODES]).toEqual(['photo', 'voice', 'manual']);
    expect([...QUALITY_GRADES]).toEqual(['A', 'B', 'C']);
  });
});

describe('buildCreateDraft', () => {
  it('requires a real product (id/category/unit)', () => {
    expect(buildCreateDraft({ ...base, productId: null }).reason).toBe('product');
  });
  it('validates qty then price', () => {
    expect(buildCreateDraft({ ...base, qty: '0' }).reason).toBe('qty');
    expect(buildCreateDraft({ ...base, rupees: 'abc' }).reason).toBe('price');
  });
  it('assembles a clean payload with paise price + product unit', () => {
    const r = buildCreateDraft(base);
    expect(r.ok).toBe(true);
    expect(r.payload).toMatchObject({ productId: 'p1', categoryId: 'c1', title: 'Wheat', quantityTotal: 5, unitCode: 'qtl', priceMinor: '280000' });
  });
  it('folds quality + description together (grade has no dedicated field yet — never dropped)', () => {
    const r = buildCreateDraft({ ...base, description: 'fresh', quality: 'A' });
    expect(r.payload!.description).toBe('fresh · Quality: A');
  });
  it('omits mediaIds when none', () => {
    expect(buildCreateDraft(base).payload!.mediaIds).toBeUndefined();
    expect(buildCreateDraft({ ...base, mediaIds: ['m1'] }).payload!.mediaIds).toEqual(['m1']);
  });
});
