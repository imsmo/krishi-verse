// Unit tests for the PURE listing-detail helpers (screen 112): relative age + health checklist.
import { relativeAge, healthItems } from '../../features/listings/listing-detail';

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
});
