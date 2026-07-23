// modules/listings/__tests__/query-listing.dto.spec.ts
// QueryListingSchema is `.strict()` (unrecognised keys 422). Mobile previously sent `box=mine`, which the schema
// rejected outright ("Unrecognized key(s): 'box'") — my-listings could never work. This proves the fix: `mine` is
// now a recognised, coerced boolean, and an unrelated unknown key is still rejected (strictness intact).
import { QueryListingSchema } from '../dto/query-listing.dto';

describe('QueryListingSchema', () => {
  it('accepts `mine=true` (string, as it arrives over querystring) and coerces to boolean', () => {
    const r = QueryListingSchema.safeParse({ mine: 'true', limit: '20' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mine).toBe(true);
  });

  it('mine is optional — omitting it parses as before', () => {
    const r = QueryListingSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mine).toBeUndefined();
  });

  it('still rejects an unrecognised key (the old `box=mine` shape) — strictness unchanged', () => {
    const r = QueryListingSchema.safeParse({ box: 'mine' });
    expect(r.success).toBe(false);
  });
});
