// modules/labour/domain/geo.ts · PURE geodesy for the attendance geofence (no I/O).
// Haversine great-circle distance in METRES between two WGS-84 points. Used to prove a clock-in is within
// the booking's ≤100m fence (PRD §31.12). Returns a rounded integer metre count (DB column is integer).
const R = 6_371_000;          // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** The clock-in geofence radius (metres). A clock-in farther than this from the farm is rejected. */
export const ATTENDANCE_FENCE_M = 100;
