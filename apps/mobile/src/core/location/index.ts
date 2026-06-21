// apps/mobile/src/core/location · public surface. PURE geofence math (haversine / clock-in eligibility / distance
// formatting) + a resilient one-shot GPS reader. Screens/features import ONLY from here.
export { haversineMeters, withinRadius, clockInEligibility, distanceParts, CLOCK_IN_RADIUS_M } from './geofence';
export type { GeoPoint, GeoFix, ClockInCheck, ClockInReason } from './geofence';
export { getCurrentFix } from './gps';
export type { GpsResult } from './gps';
