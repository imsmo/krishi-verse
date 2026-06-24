// apps/web-tenant/src/test/listings-form.spec.ts · unit tests for the new-listing form helpers. Money parsing is
// security/correctness-relevant (Law 2 — float-free), and buildCreateListingInput is the first validation gate
// before the authed Server Action calls the API, so its accept/reject behaviour is worth pinning.
import { parseMajorToMinor, encodeProductChoice, decodeProductChoice, buildCreateListingInput } from '../features/listings/form';

describe('parseMajorToMinor', () => {
  it('parses whole + fractional major units to minor-unit strings', () => {
    expect(parseMajorToMinor('120')).toBe('12000');
    expect(parseMajorToMinor('120.5')).toBe('12050');
    expect(parseMajorToMinor('120.55')).toBe('12055');
    expect(parseMajorToMinor('0.99')).toBe('99');
  });
  it('strips leading zeros but keeps a single zero', () => {
    expect(parseMajorToMinor('007.50')).toBe('750');
    expect(parseMajorToMinor('0')).toBe('0');
    expect(parseMajorToMinor('0.00')).toBe('0');
  });
  it('rejects malformed / over-precise / empty input', () => {
    expect(parseMajorToMinor('12.345')).toBeUndefined();
    expect(parseMajorToMinor('abc')).toBeUndefined();
    expect(parseMajorToMinor('1,000')).toBeUndefined();
    expect(parseMajorToMinor('')).toBeUndefined();
    expect(parseMajorToMinor(undefined)).toBeUndefined();
    expect(parseMajorToMinor('-5')).toBeUndefined();
  });
});

describe('product choice encode/decode', () => {
  it('round-trips', () => {
    const c = { id: 'p1', categoryId: 'c1', defaultUnit: 'kg' };
    expect(decodeProductChoice(encodeProductChoice(c))).toEqual(c);
  });
  it('rejects malformed values', () => {
    expect(decodeProductChoice('')).toBeNull();
    expect(decodeProductChoice('p1|c1')).toBeNull();
    expect(decodeProductChoice('p1||kg')).toBeNull();
    expect(decodeProductChoice(undefined)).toBeNull();
  });
});

describe('buildCreateListingInput', () => {
  const base = { product: 'p1|c1|kg', title: 'Fresh tomatoes', quantityTotal: '100', priceMajor: '45.50' };

  it('assembles a valid payload with derived category + unit', () => {
    const r = buildCreateListingInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ productId: 'p1', categoryId: 'c1', unitCode: 'kg', priceMinor: '4550', currencyCode: 'INR', quantityTotal: 100, saleType: 'direct', organicClaim: 'none', visibility: 'tenant' });
    }
  });
  it('coerces unknown enums to safe defaults', () => {
    const r = buildCreateListingInput({ ...base, saleType: 'hack', organicClaim: 'x', visibility: 'world' });
    expect(r.ok && r.value.saleType).toBe('direct');
    expect(r.ok && r.value.organicClaim).toBe('none');
    expect(r.ok && r.value.visibility).toBe('tenant');
  });
  it('rejects bad product / title / qty / price', () => {
    expect(buildCreateListingInput({ ...base, product: 'bad' })).toEqual({ ok: false, error: 'errorProduct' });
    expect(buildCreateListingInput({ ...base, title: 'ab' })).toEqual({ ok: false, error: 'errorTitle' });
    expect(buildCreateListingInput({ ...base, quantityTotal: '0' })).toEqual({ ok: false, error: 'errorQty' });
    expect(buildCreateListingInput({ ...base, priceMajor: '0' })).toEqual({ ok: false, error: 'errorPrice' });
    expect(buildCreateListingInput({ ...base, priceMajor: 'x' })).toEqual({ ok: false, error: 'errorPrice' });
  });
  it('rejects minOrderQty greater than total', () => {
    expect(buildCreateListingInput({ ...base, minOrderQty: '200' })).toEqual({ ok: false, error: 'errorQty' });
    expect(buildCreateListingInput({ ...base, minOrderQty: '10' }).ok).toBe(true);
  });
  it('keeps confirmed mediaIds and drops blanks', () => {
    const r = buildCreateListingInput({ ...base, mediaIds: ['m1', '', ' m2 '] });
    expect(r.ok && r.value.mediaIds).toEqual(['m1', 'm2']);
  });
});
