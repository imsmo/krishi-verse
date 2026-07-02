// apps/mobile/src/features/listings/create-listing.ts · PURE logic for screen 10 (Create Listing). Owns the
// capture-mode vocabulary (Photo / Voice / Manual), the STT language set, and client-side validation + money
// conversion (₹ → paise as a bigint-minor STRING, Law 2 — never a float). No I/O — unit-tested. The screen
// gathers a product (real catalogue id), quantity, ₹/unit price and optional photos/quality, calls
// buildCreateDraft() to validate + assemble, then hands the result to listings.api.createListing().
//
// FLAGGED GAP (never faked): the design's "✨ AI Detected" card is meant to auto-fill crop/qty/price/quality from
// the spoken transcript. The structured extractor exists in ai-services (POST /v1/voice-extraction) but is NOT
// yet exposed through apps/api or the SDK, so the mobile client cannot call it. Until that endpoint lands, the
// AI-Detected fields are farmer-confirmed (the live transcript is real on-device STT); we never invent values.

export type CreateMode = 'photo' | 'voice' | 'manual';
export const CREATE_MODES: readonly CreateMode[] = Object.freeze(['photo', 'voice', 'manual']);

// STT languages offered on the voice panel (subset of the launch locales). Codes match @krishi-verse/i18n.
export const STT_LANGS: readonly string[] = Object.freeze(['hi', 'en', 'gu']);

// Quality grades shown on the AI-Detected card. Appended to the listing description (there is no dedicated
// grade field on the create contract yet — flagged); never silently dropped.
export type QualityGrade = 'A' | 'B' | 'C';
export const QUALITY_GRADES: readonly QualityGrade[] = Object.freeze(['A', 'B', 'C']);

/** ₹ (whole rupees, as typed) → paise bigint-minor string, or null if not a clean positive integer ≤ 13 digits. */
export function rupeesToPaise(rupees: string): string | null {
  const s = (rupees ?? '').trim();
  if (!/^\d{1,13}$/.test(s)) return null;
  return (BigInt(s) * 100n).toString();
}

/** Quantity → positive integer ≤ 7 digits, or null. */
export function parseQty(qty: string): number | null {
  const s = (qty ?? '').trim();
  if (!/^\d{1,7}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

export interface ListingDraftForm {
  productId: string | null;
  categoryId: string | null;
  title: string | null;
  defaultUnit: string | null;
  qty: string;
  rupees: string;
  description?: string;
  quality?: QualityGrade | null;
  mediaIds?: string[];
}

export interface DraftResult {
  ok: boolean;
  reason?: 'product' | 'qty' | 'price';
  payload?: {
    productId: string; categoryId: string; title: string; description?: string;
    quantityTotal: number; unitCode: string; priceMinor: string; mediaIds?: string[];
  };
}

/** Validate + assemble the create payload. The product (real catalogue id/unit) is required; qty + price must be
 * clean; quality (if chosen) is folded into the description so it is never lost. Server re-validates (§4). */
export function buildCreateDraft(form: ListingDraftForm): DraftResult {
  if (!form.productId || !form.categoryId || !form.title || !form.defaultUnit) return { ok: false, reason: 'product' };
  const quantityTotal = parseQty(form.qty);
  if (quantityTotal == null) return { ok: false, reason: 'qty' };
  const priceMinor = rupeesToPaise(form.rupees);
  if (priceMinor == null) return { ok: false, reason: 'price' };

  const descParts = [form.description?.trim(), form.quality ? `Quality: ${form.quality}` : ''].filter(Boolean);
  const description = descParts.length ? descParts.join(' · ') : undefined;

  return {
    ok: true,
    payload: {
      productId: form.productId, categoryId: form.categoryId, title: form.title, description,
      quantityTotal, unitCode: form.defaultUnit, priceMinor,
      mediaIds: form.mediaIds && form.mediaIds.length ? form.mediaIds : undefined,
    },
  };
}
