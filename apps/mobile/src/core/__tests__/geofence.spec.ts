// Unit tests for the PURE geo-attendance math (core/location/geofence) — the DoD invariant "clock-in blocked
// outside 100m". No native deps. Distances cross-checked against known coordinate pairs.
import { haversineMeters, withinRadius, clockInEligibility, distanceParts, CLOCK_IN_RADIUS_M } from '../location/geofence';

const FARM = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad-ish

describe('haversineMeters', () => {
  it('is ~0 for identical points', () => {
    expect(haversineMeters(FARM, FARM)).toBeCloseTo(0, 5);
  });
  it('matches a known ~1.11km north offset (~0.01° lat)', () => {
    const d = haversineMeters(FARM, { lat: FARM.lat + 0.01, lng: FARM.lng });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1115);
  });
  it('fails closed (Infinity) on bad input', () => {
    expect(haversineMeters(FARM, { lat: NaN, lng: 0 })).toBe(Infinity);
  });
});

describe('withinRadius', () => {
  it('true just inside, false just outside', () => {
    const near = { lat: FARM.lat + 0.0003, lng: FARM.lng };  // ~33m
    const far = { lat: FARM.lat + 0.002, lng: FARM.lng };    // ~222m
    expect(withinRadius(near, FARM, CLOCK_IN_RADIUS_M)).toBe(true);
    expect(withinRadius(far, FARM, CLOCK_IN_RADIUS_M)).toBe(false);
  });
  it('false for a non-positive radius', () => {
    expect(withinRadius(FARM, FARM, 0)).toBe(false);
  });
});

describe('clockInEligibility (the 100m gate)', () => {
  it('ok within the fence with a good fix', () => {
    const r = clockInEligibility({ here: { ...FARM, accuracyM: 8 }, farm: FARM });
    expect(r.ok).toBe(true);
    expect(r.distanceM).toBe(0);
  });
  it('blocks when too far, with distance + reason', () => {
    const r = clockInEligibility({ here: { lat: FARM.lat + 0.002, lng: FARM.lng, accuracyM: 8 }, farm: FARM });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too_far');
    expect(r.distanceM).toBeGreaterThan(100);
  });
  it('blocks a low-accuracy fix even if nominally near', () => {
    const r = clockInEligibility({ here: { ...FARM, accuracyM: 120 }, farm: FARM });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('low_accuracy');
  });
  it('blocks with no_fix / no_farm_location', () => {
    expect(clockInEligibility({ here: null, farm: FARM }).reason).toBe('no_fix');
    expect(clockInEligibility({ here: { ...FARM }, farm: null }).reason).toBe('no_farm_location');
  });
  it('honours a custom radius', () => {
    const here = { lat: FARM.lat + 0.0003, lng: FARM.lng, accuracyM: 5 }; // ~33m
    expect(clockInEligibility({ here, farm: FARM, radiusM: 10 }).ok).toBe(false);
    expect(clockInEligibility({ here, farm: FARM, radiusM: 100 }).ok).toBe(true);
  });
});

describe('distanceParts', () => {
  it('metres under 1km (rounded to 10m), km above', () => {
    expect(distanceParts(124)).toEqual({ value: '120', unit: 'm' });
    expect(distanceParts(1500)).toEqual({ value: '1.5', unit: 'km' });
    expect(distanceParts(-1)).toEqual({ value: '–', unit: 'm' });
  });
});
