// Unit tests for the PURE listing-detail helpers (screen 112): relative age + health checklist + EXTEND clamp.
import { relativeAge, healthItems, clampExtendDays, EXTEND_MIN_DAYS, EXTEND_MAX_DAYS } from '../../features/listings/listing-detail';

describe('relativeAge', () => {
  const now = Date.parse('2026-06-30T10:00:00Z');
  it('buckets today / days / weeks / months', () => {
    expect(relativeAge('2026-06-30T08:00:00Z', now)).toEqual({ unit: 'today', value: 0 });
    expect(relativeAge('2026-06-27T10:00:00Z', now)).toEqual({ unit: 'day', value: 3 });
    expect(relativeAge('2026-06-10T10:00:00Z', now)).toEqual({ unit: 'week', value: 2 });
    expect(relativeAge('2026-04-30T10:00:00Z', now)).toEqual({ unit: 'month', value: 2 });
  });
  it('nulls on missing/unparseable', () => {
    expect(relativeAge(null, now)).toBeNull();
    expect(relativeAge('nope', now)).toBeNull();
  });
});

describe('healthItems', () => {
  it('photos ≥3 is good, <3 warns', () => {
    expect(healthItems({ photoCount: 4, boostActive: false })[0]).toMatchObject({ tone: 'good', count: 4 });
    expect(healthItems({ photoCount: 1, boostActive: false })[0]).toMatchObject({ tone: 'warn', count: 1 });
  });
  it('adds a boosted row only when boost is active', () => {
    expect(healthItems({ photoCount: 4, boostActive: true }).some((i) => i.id === 'boosted')).toBe(true);
    expect(healthItems({ photoCount: 4, boostActive: false }).some((i) => i.id === 'boosted')).toBe(false);
  });
  it('never fabricates lab-report/expiry rows (not in the read-model)', () => {
    const ids = healthItems({ photoCount: 4, boostActive: true }).map((i) => i.id);
    expect(ids).not.toContain('lab-report');
    expect(ids).not.toContain('expiry');
  });
  // KV-MF-14 (founder video review): "Add more photos (0)" must be a REAL, tappable cta up to the cap —
  // never a dead label — for both the warn row (<3) and the good row (≥3, "N photos added" can still grow).
  it('the photo row is actionable below the MAX_LISTING_PHOTOS cap, both warn and good tone', () => {
    expect(healthItems({ photoCount: 0, boostActive: false })[0]).toMatchObject({ tone: 'warn', count: 0, actionable: true });
    expect(healthItems({ photoCount: 4, boostActive: false })[0]).toMatchObject({ tone: 'good', count: 4, actionable: true });
  });
  it('the photo row is NOT actionable once the cap is reached', () => {
    expect(healthItems({ photoCount: 10, boostActive: false })[0]).toMatchObject({ tone: 'good', count: 10, actionable: false });
  });
});

describe('clampExtendDays (screen 112 EXTEND cta, KV-BL-031)', () => {
  it('clamps to the API-accepted range [1,30]', () => {
    expect(clampExtendDays(0)).toBe(EXTEND_MIN_DAYS);
    expect(clampExtendDays(-5)).toBe(EXTEND_MIN_DAYS);
    expect(clampExtendDays(31)).toBe(EXTEND_MAX_DAYS);
    expect(clampExtendDays(1000)).toBe(EXTEND_MAX_DAYS);
  });
  it('passes through valid in-range integers', () => {
    expect(clampExtendDays(1)).toBe(1);
    expect(clampExtendDays(7)).toBe(7);
    expect(clampExtendDays(30)).toBe(30);
  });
  it('rounds a fractional value', () => {
    expect(clampExtendDays(7.6)).toBe(8);
    expect(clampExtendDays(7.4)).toBe(7);
  });
});
