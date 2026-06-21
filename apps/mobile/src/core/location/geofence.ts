// apps/mobile/src/core/location/geofence.ts · PURE geo-attendance math for worker clock-in (P-13). No expo/native
// deps → unit-tested. The DoD invariant — "clock-in is blocked outside 100m of the farm" — lives here as honest,
// reusable logic. THE SERVER IS THE AUTHORITY: a real attendance POST must re-verify the fix server-side (a
// rooted device can fake GPS); this only gates the UI so an honest worker is never allowed to clock in from afar.
// All distances are metres; coordinates are decimal degrees (WGS-84).

export interface GeoPoint { lat: number; lng: number }
export interface GeoFix extends GeoPoint { accuracyM?: number | null }

const EARTH_RADIUS_M = 6_371_008.8; // mean Earth radius (IUGG)
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in metres (haversine). Returns a finite non-negative number;
 * NaN/∞ inputs yield Infinity so callers fail closed (treated as "too far"). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every((n) => typeof n === 'number' && Number.isFinite(n))) return Infinity;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True if `here` is within `radiusM` of `target`. Defensive against bad inputs (→ false). */
export function withinRadius(here: GeoPoint, target: GeoPoint, radiusM: number): boolean {
  if (!Number.isFinite(radiusM) || radiusM <= 0) return false;
  return haversineMeters(here, target) <= radiusM;
}

export const CLOCK_IN_RADIUS_M = 100; // the PRD attendance fence
const MAX_ACCURACY_M = 50;            // reject a fix too imprecise to trust against a 100m fence

export type ClockInReason = 'no_fix' | 'no_farm_location' | 'low_accuracy' | 'too_far';
export interface ClockInCheck { ok: boolean; distanceM: number | null; reason?: ClockInReason }

/** Decide whether an honest worker may clock in: requires a recent GPS fix of usable accuracy, a known farm
 * location, and being within the fence (default 100m). Pure + deterministic → the centerpiece unit test.
 * `ok:false` always carries a reason the UI can explain; distance is null when it can't be computed. */
export function clockInEligibility(args: { here?: GeoFix | null; farm?: GeoPoint | null; radiusM?: number }): ClockInCheck {
  const radiusM = args.radiusM ?? CLOCK_IN_RADIUS_M;
  const { here, farm } = args;
  if (!here || !Number.isFinite(here.lat) || !Number.isFinite(here.lng)) return { ok: false, distanceM: null, reason: 'no_fix' };
  if (!farm || !Number.isFinite(farm.lat) || !Number.isFinite(farm.lng)) return { ok: false, distanceM: null, reason: 'no_farm_location' };
  if (here.accuracyM != null && Number.isFinite(here.accuracyM) && here.accuracyM > MAX_ACCURACY_M) {
    return { ok: false, distanceM: Math.round(haversineMeters(here, farm)), reason: 'low_accuracy' };
  }
  const distanceM = Math.round(haversineMeters(here, farm));
  if (distanceM > radiusM) return { ok: false, distanceM, reason: 'too_far' };
  return { ok: true, distanceM };
}

/** Human-friendly distance for display, as a {value, unit} pair the screen formats via i18n (never an English
 * literal). <1000m → metres (rounded to 10m), else kilometres (1 dp). */
export function distanceParts(meters: number): { value: string; unit: 'm' | 'km' } {
  if (!Number.isFinite(meters) || meters < 0) return { value: '–', unit: 'm' };
  if (meters < 1000) return { value: String(Math.round(meters / 10) * 10), unit: 'm' };
  return { value: (meters / 1000).toFixed(1), unit: 'km' };
}
