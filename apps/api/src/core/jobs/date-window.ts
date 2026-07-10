// core/jobs/date-window.ts · pure helper (clock injected → unit-testable): the [from, to) UTC calendar-day
// window a nightly cadence job should process. Used by the settlement-statements cadence job to generate
// "yesterday's" statements regardless of what time the tick actually fires.
/** Yesterday's UTC calendar day as a `[from, to)` pair of `YYYY-MM-DD` strings, e.g. run at
 *  2026-07-10T02:00Z → { from: '2026-07-09', to: '2026-07-10' }. */
export function previousUtcDayWindow(now: Date): { from: string; to: string } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function toIsoDate(d: Date): string { return d.toISOString().slice(0, 10); }
