// apps/mobile/src/features/listings/listing-detail.ts · PURE helpers for screen 112 (My Listing detail):
// a relative "listed N days ago" formatter and the Listing-Health checklist derivation. No I/O — unit-tested.
//
// FLAGGED GAPS (never faked): the design's health checklist also shows "Lab report missing" and "Listing expires
// in N days". Neither a certificate/lab-report flag nor a listing expiry date is exposed by the listing
// read-model yet, so those rows are omitted here and surfaced only once the API returns them. Grade/moisture and
// the fair-price/verified-location chips are likewise not on the read-model (omitted + flagged in the screen).

export type AgeUnit = 'today' | 'day' | 'week' | 'month';
export interface RelativeAge { unit: AgeUnit; value: number }

/** ISO timestamp → coarse relative age buckets (pure; `now` injected). Null when absent/unparseable. */
export function relativeAge(iso: string | null | undefined, nowMs = Date.now()): RelativeAge | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((nowMs - t) / 86_400_000);
  if (days <= 0) return { unit: 'today', value: 0 };
  if (days < 7) return { unit: 'day', value: days };
  if (days < 30) return { unit: 'week', value: Math.floor(days / 7) };
  return { unit: 'month', value: Math.floor(days / 30) };
}

// KV-MF-14 (founder video review): the cap a farmer can attach to ONE listing — mirrors the API's
// MAX_LISTING_PHOTOS (listing.service.ts) / CreateListingSchema's mediaIds max(10). Kept in sync manually
// (no shared contract package for this single number yet); the server is the actual enforcement point —
// this is only used client-side to give an honest "you're at the limit" message before even opening the
// picker, not as the source of truth.
export const MAX_LISTING_PHOTOS = 10;

export type HealthTone = 'good' | 'warn';
export interface HealthItem { id: string; tone: HealthTone; /** i18n key for the line */ labelKey: string; /** count arg, if any */ count?: number; /** true when this row's action ("Add more photos") is a real, tappable cta — never a dead label (KV-MF-14) */ actionable?: boolean }

/** Listing-health checklist from the REAL data we have (photo count + boost). Items needing fields the read-model
 * doesn't expose yet (lab report, expiry) are intentionally NOT emitted here — the screen flags that gap rather
 * than fabricating a warning. */
export function healthItems(input: { photoCount: number; boostActive: boolean }): HealthItem[] {
  const items: HealthItem[] = [];
  // KV-MF-14: both the "add more" (warn, <3 photos) AND the "N photos added" (good, ≥3) rows are actionable
  // up to the cap — the screen wires this to the same real add-photo flow either way (never a dead label).
  const actionable = input.photoCount < MAX_LISTING_PHOTOS;
  if (input.photoCount >= 3) items.push({ id: 'photos-ok', tone: 'good', labelKey: 'listingDetail.health.photosOk', count: input.photoCount, actionable });
  else items.push({ id: 'photos-low', tone: 'warn', labelKey: 'listingDetail.health.photosLow', count: input.photoCount, actionable });
  if (input.boostActive) items.push({ id: 'boosted', tone: 'good', labelKey: 'listingDetail.health.boosted' });
  return items;
}

// --- EXTEND (screen 112 EXTEND cta, KV-BL-031) ---
export const EXTEND_MIN_DAYS = 1;
export const EXTEND_MAX_DAYS = 30;
export const EXTEND_DEFAULT_DAYS = 7;

/** Clamp a days value to the API's accepted range [1,30] (ExtendListingSchema mirror) and coerce to an integer —
 * pure, so the +/- stepper can never submit an out-of-range or fractional value regardless of tap sequence. */
export function clampExtendDays(days: number): number {
  const n = Math.round(days);
  if (!Number.isFinite(n)) return EXTEND_DEFAULT_DAYS;
  return Math.min(EXTEND_MAX_DAYS, Math.max(EXTEND_MIN_DAYS, n));
}
