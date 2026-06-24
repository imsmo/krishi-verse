// modules/tenancy/__tests__/analytics-window.spec.ts · pure window resolution for the analytics read (API-W10).
import { resolveWindow, MAX_WINDOW_DAYS } from '../domain/analytics-window';

const NOW = new Date('2026-06-25T00:00:00Z');
const DAY = 86_400_000;

describe('resolveWindow', () => {
  it('defaults to the last 30 days when nothing is given', () => {
    const { from, to } = resolveWindow(undefined, undefined, NOW);
    expect(to.getTime()).toBe(NOW.getTime());
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
  });
  it('honours an explicit valid range', () => {
    const { from, to } = resolveWindow('2026-06-01T00:00:00Z', '2026-06-20T00:00:00Z', NOW);
    expect(from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-06-20T00:00:00.000Z');
  });
  it('falls back to default span on an inverted range', () => {
    const { from, to } = resolveWindow('2026-06-20T00:00:00Z', '2026-06-01T00:00:00Z', NOW);
    expect(to.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
  });
  it('clamps a span longer than the max', () => {
    const { from, to } = resolveWindow('2000-01-01T00:00:00Z', '2026-06-25T00:00:00Z', NOW);
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(MAX_WINDOW_DAYS);
  });
  it('ignores garbage dates and defaults', () => {
    const { from, to } = resolveWindow('not-a-date', 'also-bad', NOW);
    expect(to.getTime()).toBe(NOW.getTime());
    expect(Math.round((to.getTime() - from.getTime()) / DAY)).toBe(30);
  });
});
