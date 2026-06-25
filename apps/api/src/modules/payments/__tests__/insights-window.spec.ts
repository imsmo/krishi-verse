// modules/payments/__tests__/insights-window.spec.ts · the bounded-window helper for wallet insights (pure).
import { resolveWindow } from '../read-models/insights-window';

const NOW = new Date('2026-06-15T00:00:00.000Z');

describe('resolveWindow', () => {
  it('defaults to ~12 months ending now when nothing supplied', () => {
    const w = resolveWindow(undefined, undefined, NOW);
    expect(new Date(w.toIso).getTime()).toBeLessThanOrEqual(NOW.getTime() + 86_400_000);
    const days = (new Date(w.toIso).getTime() - new Date(w.fromIso).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(366);
  });

  it('honours a valid in-range window', () => {
    const w = resolveWindow('2026-01-01', '2026-03-01', NOW);
    expect(w.fromIso.startsWith('2026-01-01')).toBe(true);
    expect(w.toIso.startsWith('2026-03-01')).toBe(true);
  });

  it('clamps an over-long span to ≤ 3 years', () => {
    const w = resolveWindow('2010-01-01', '2026-06-01', NOW);
    const days = (new Date(w.toIso).getTime() - new Date(w.fromIso).getTime()) / 86_400_000;
    expect(days).toBeLessThanOrEqual(366 * 3 + 1);
  });

  it('collapses an inverted window (from > to) to the default span', () => {
    const w = resolveWindow('2026-06-01', '2026-01-01', NOW);
    expect(new Date(w.fromIso).getTime()).toBeLessThanOrEqual(new Date(w.toIso).getTime());
  });

  it('never lets `to` run far into the future', () => {
    const w = resolveWindow(undefined, '2099-01-01', NOW);
    expect(new Date(w.toIso).getTime()).toBeLessThanOrEqual(NOW.getTime() + 86_400_000);
  });

  it('ignores invalid dates (falls back to defaults)', () => {
    const w = resolveWindow('not-a-date', 'also-bad', NOW);
    const days = (new Date(w.toIso).getTime() - new Date(w.fromIso).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(366);
  });
});
