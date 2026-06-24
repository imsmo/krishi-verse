// modules/ambassadors/__tests__/ambassadors-w9.spec.ts · pure-domain unit tests for API-W9 (field-ops).
// No infra: the leaderboard ranking helper (ties share a place), the visit-log factory + event, and the
// target value-object invariants (period order + non-negative; bigint minor for earnings_minor).
import { assignRanks } from '../read-models/leaderboard.read-model';
import { AmbassadorVisit } from '../domain/ambassador-visit.entity';
import { AmbassadorTarget } from '../domain/ambassador-target.entity';
import { AmbassadorEventType } from '../domain/ambassadors.events';

describe('leaderboard.assignRanks — competition ranking', () => {
  it('ranks distinct descending earnings 1,2,3', () => {
    expect(assignRanks([{ earnedMinor: 900n }, { earnedMinor: 500n }, { earnedMinor: 100n }])).toEqual([1, 2, 3]);
  });
  it('ties share a place and the next value jumps (1,2,2,4)', () => {
    expect(assignRanks([{ earnedMinor: 900n }, { earnedMinor: 500n }, { earnedMinor: 500n }, { earnedMinor: 100n }])).toEqual([1, 2, 2, 4]);
  });
  it('all-zero (no earnings yet) all rank 1', () => {
    expect(assignRanks([{ earnedMinor: 0n }, { earnedMinor: 0n }])).toEqual([1, 1]);
  });
  it('empty board → empty ranks', () => { expect(assignRanks([])).toEqual([]); });
});

describe('AmbassadorVisit.log', () => {
  it('builds a visit + emits visit_logged', () => {
    const v = AmbassadorVisit.log({ id: 'v1', tenantId: 't1', ambassadorId: 'a1', visitedUserId: null, purpose: 'onboarding', notes: null, lat: 22.3, lng: 71.1, regionId: null, visitedAt: new Date() });
    expect(v.toJSON().purpose).toBe('onboarding');
    expect(v.pullEvents().map((e) => e.type)).toContain(AmbassadorEventType.VisitLogged);
  });
  it('allows a prospect visit with no visited user', () => {
    const v = AmbassadorVisit.log({ id: 'v2', tenantId: 't1', ambassadorId: 'a1', visitedUserId: null, purpose: 'followup', notes: 'not home', lat: null, lng: null, regionId: null, visitedAt: new Date() });
    expect(v.toJSON().visitedUserId).toBeNull();
  });
});

describe('AmbassadorTarget.set — invariants', () => {
  const base = { id: 't1', tenantId: 'T', ambassadorId: 'a1', periodStart: '2026-07-01', periodEnd: '2026-07-31' };
  it('accepts a valid count target + emits target_set', () => {
    const t = AmbassadorTarget.set({ ...base, metric: 'onboardings', targetValue: 20n });
    expect(t.toJSON().targetValue).toBe('20');
    expect(t.pullEvents().map((e) => e.type)).toContain(AmbassadorEventType.TargetSet);
  });
  it('keeps earnings_minor as a bigint minor string', () => {
    const t = AmbassadorTarget.set({ ...base, metric: 'earnings_minor', targetValue: 5000000n });
    expect(t.toJSON().targetValue).toBe('5000000');
  });
  it('rejects period_end before period_start', () => {
    expect(() => AmbassadorTarget.set({ ...base, periodStart: '2026-07-31', periodEnd: '2026-07-01', metric: 'visits', targetValue: 5n })).toThrow();
  });
  it('rejects a negative target', () => {
    expect(() => AmbassadorTarget.set({ ...base, metric: 'visits', targetValue: -1n })).toThrow();
  });
});
