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

export type HealthTone = 'good' | 'warn';
export interface HealthItem { id: string; tone: HealthTone; /** i18n key for the line */ labelKey: string; /** count arg, if any */ count?: number }

/** Listing-health checklist from the REAL data we have (photo count + boost). Items needing fields the read-model
 * doesn't expose yet (lab report, expiry) are intentionally NOT emitted here — the screen flags that gap rather
 * than fabricating a warning. */
export function healthItems(input: { photoCount: number; boostActive: boolean }): HealthItem[] {
  const items: HealthItem[] = [];
  if (input.photoCount >= 3) items.push({ id: 'photos-ok', tone: 'good', labelKey: 'listingDetail.health.photosOk', count: input.photoCount });
  else items.push({ id: 'photos-low', tone: 'warn', labelKey: 'listingDetail.health.photosLow', count: input.photoCount });
  if (input.boostActive) items.push({ id: 'boosted', tone: 'good', labelKey: 'listingDetail.health.boosted' });
  return items;
}
