// Unit tests for the PURE create-listing logic (screen 10): money conversion + draft assembly. No I/O.
import {
  rupeesToPaise, parseQty, buildCreateDraft, CREATE_MODES, QUALITY_GRADES,
  resolveModeParam, shouldShowVoiceComingSoon, speakToSellTargetMode, shouldShowPriceSummary,
  type ListingDraftForm,
} from '../../features/listings/create-listing';

const base: ListingDraftForm = { productId: 'p1', categoryId: 'c1', title: 'Wheat', defaultUnit: 'qtl', qty: '5', rupees: '2800' };

describe('money + qty parsing', () => {
  it('rupees→paise as a bigint-minor string (Law 2, never float internally)', () => {
    expect(rupeesToPaise('2800')).toBe('280000');
    expect(rupeesToPaise('1')).toBe('100');
    // S6 device-test fix: parsers now match the SERVER contract (CreateListingSchema).
    // ₹ decimals up to 2 places are exactly representable in paise — BigInt math, still no floats:
    expect(rupeesToPaise('28.5')).toBe('2850');
    expect(rupeesToPaise('2500.50')).toBe('250050');
    expect(rupeesToPaise('2,500')).toBe('250000');       // Indian-style grouping tolerated
    // '0' now rejected: the server requires POSITIVE paise (priceMinor regex ^[1-9]\d{0,15}$) —
    // the old '0'→'0' behavior would have 422'd at submit anyway.
    expect(rupeesToPaise('0')).toBeNull();
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
    expect(rupeesToPaise('28.555')).toBeNull();          // >2 decimal places not representable
    expect(rupeesToPaise('12345678901234')).toBeNull();  // >13 digits
  });
  it('qty is a positive number ≤ 1,000,000 — decimals allowed (server: z.number().positive(); 2.5 qtl is real)', () => {
    expect(parseQty('5')).toBe(5);
    expect(parseQty('5.5')).toBe(5.5);
    expect(parseQty('2.500')).toBe(2.5);
    expect(parseQty('0')).toBeNull();
    expect(parseQty('0.0')).toBeNull();
    expect(parseQty('12345678')).toBeNull();
    expect(parseQty('1000001')).toBeNull();   // > server max(1_000_000)
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

// KV-MF-05 / KV-MF-13: voice STT is gated by the `voice_listing` client flag until ai-services
// voice-extraction is exposed via apps/api. These pure helpers back the mode-resolution + gating decisions
// in new.tsx and the Home hero — no dead mic, no never-filling transcript, no dead-end route.
describe('resolveModeParam', () => {
  it('accepts a real mode from the route param', () => {
    expect(resolveModeParam('photo')).toBe('photo');
    expect(resolveModeParam('voice')).toBe('voice');
    expect(resolveModeParam('manual')).toBe('manual');
  });
  it('unwraps an array param (expo-router can hand back string[])', () => {
    expect(resolveModeParam(['manual', 'voice'])).toBe('manual');
  });
  it('falls back to voice (design 10 default) for anything unrecognised or absent', () => {
    expect(resolveModeParam(undefined)).toBe('voice');
    expect(resolveModeParam(null)).toBe('voice');
    expect(resolveModeParam('')).toBe('voice');
    expect(resolveModeParam('bogus')).toBe('voice');
    expect(resolveModeParam([])).toBe('voice');
  });
});

describe('shouldShowVoiceComingSoon', () => {
  it('gates only the voice tab, only while the flag is OFF', () => {
    expect(shouldShowVoiceComingSoon('voice', false)).toBe(true);
    expect(shouldShowVoiceComingSoon('voice', true)).toBe(false);
    expect(shouldShowVoiceComingSoon('photo', false)).toBe(false);
    expect(shouldShowVoiceComingSoon('manual', false)).toBe(false);
  });
});

describe('speakToSellTargetMode', () => {
  it('Home hero routes to Manual while voice_listing is OFF, Voice once it ships', () => {
    expect(speakToSellTargetMode(false)).toBe('manual');
    expect(speakToSellTargetMode(true)).toBe('voice');
  });
});

// KV-MF-09: the "Price/qtl: —" summary row below the Quantity/Price inputs must never render a placeholder
// dash, and must never show a price before a crop is even picked (no context for what unit it's per). It only
// appears once BOTH a real parsed price AND a confirmed product exist — otherwise hidden entirely.
describe('shouldShowPriceSummary', () => {
  it('hides while the price is not yet a clean positive value, even with a product picked', () => {
    expect(shouldShowPriceSummary(null, true)).toBe(false);
  });
  it('hides once a valid price is typed but no crop has been picked yet', () => {
    expect(shouldShowPriceSummary('280000', false)).toBe(false);
  });
  it('hides when neither a price nor a product exists (fresh screen)', () => {
    expect(shouldShowPriceSummary(null, false)).toBe(false);
  });
  it('shows only once both a real price AND a picked product exist', () => {
    expect(shouldShowPriceSummary('280000', true)).toBe(true);
  });
});
