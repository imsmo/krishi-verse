// apps/mobile/src/core/__tests__/create-listing-contract.spec.ts · cross-checks buildCreateDraft()'s assembled
// payload against the REAL API contract (apps/api/src/modules/listings/dto/create-listing.dto.ts's
// CreateListingSchema — a zod `.strict()` object). Mobile doesn't depend on the `zod` package (API-only), and
// the two apps aren't wired for a cross-package type import here, so — per this repo's convention of testing
// PURE logic without pulling in the other app's runtime (see create-listing.spec.ts) — this mirrors the
// schema's FIELD SHAPE (required vs optional/defaulted vs the exact key set `.strict()` allows) so a mobile
// payload change that drifts from the server contract fails a fast, local test instead of a live 422 (KV-MF-02:
// the founder's repro build the crop/qty/price/photo payload and got a real POST failure that was then silently
// swallowed by the offline queue — see write-classify.spec.ts + offline-queue.spec.ts for that half of the fix).
// If CreateListingSchema's shape changes, update ALLOWED_FIELDS/REQUIRED_FIELDS here to match.
import { buildCreateDraft, type ListingDraftForm } from '../../features/listings/create-listing';

/** Every key CreateListingSchema's `.strict()` accepts — anything else 422s. */
const ALLOWED_FIELDS = new Set([
  'productId', 'categoryId', 'title', 'description', 'quantityTotal', 'minOrderQty', 'unitCode',
  'priceMinor', 'currencyCode', 'saleType', 'organicClaim', 'pincode', 'regionId', 'lat', 'lng',
  'visibility', 'publishAt', 'attributes', 'mediaIds',
]);

/** Fields CreateListingSchema requires with NO `.optional()`/`.default()` — must always be present. */
const REQUIRED_FIELDS = ['productId', 'categoryId', 'title', 'quantityTotal', 'unitCode', 'priceMinor'];

const form: ListingDraftForm = {
  productId: 'p-uuid-1', categoryId: 'c-uuid-1', title: 'Wheat', defaultUnit: 'qtl', qty: '10', rupees: '100',
};

describe('buildCreateDraft payload vs CreateListingSchema (API contract)', () => {
  it('never emits a key the server .strict() schema would reject (the exact 422 risk)', () => {
    const { payload } = buildCreateDraft(form);
    for (const key of Object.keys(payload!)) {
      expect(ALLOWED_FIELDS.has(key)).toBe(true);
    }
  });

  it('always includes every field the schema requires (no default/optional)', () => {
    const { payload } = buildCreateDraft(form);
    for (const key of REQUIRED_FIELDS) {
      expect(payload).toHaveProperty(key);
      expect((payload as unknown as Record<string, unknown>)[key]).not.toBeUndefined();
    }
  });

  it('priceMinor matches the server regex exactly (^[1-9]\\d{0,15}$ — positive integer minor units)', () => {
    const { payload } = buildCreateDraft(form);
    expect(payload!.priceMinor).toMatch(/^[1-9]\d{0,15}$/);
  });

  it('quantityTotal is a NUMBER (server: z.number()), never a numeric string', () => {
    const { payload } = buildCreateDraft(form);
    expect(typeof payload!.quantityTotal).toBe('number');
  });

  it('the reported repro shape (Wheat via suggestion tap, qty 10, price ₹100, 1 photo) assembles cleanly', () => {
    const r = buildCreateDraft({ ...form, mediaIds: ['m-uuid-1'] });
    expect(r.ok).toBe(true);
    expect(r.payload).toMatchObject({ productId: 'p-uuid-1', categoryId: 'c-uuid-1', title: 'Wheat', unitCode: 'qtl', quantityTotal: 10, priceMinor: '10000', mediaIds: ['m-uuid-1'] });
    for (const key of Object.keys(r.payload!)) expect(ALLOWED_FIELDS.has(key)).toBe(true);
  });

  it('omits mediaIds entirely (rather than sending []) when there are no confirmed photos — still schema-valid (optional)', () => {
    const { payload } = buildCreateDraft(form);
    expect(payload!.mediaIds).toBeUndefined();
  });
});
