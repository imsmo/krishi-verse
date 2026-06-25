// modules/payments/read-models/insights-window.ts · PURE window helpers for the wallet earnings/spending-insights
// read-models (unit-tested, no I/O). Clamps the requested [from,to] window to a bounded range so a query can't be
// asked to scan the whole ledger (Law: bounded everything). Defaults to the last 12 months.
export interface ResolvedWindow { fromIso: string; toIso: string }

const DAY = 86_400_000;
const MAX_DAYS = 366 * 3; // ≤ 3 years
const DEFAULT_DAYS = 366;  // ~12 months

/** Parse an ISO date (date or datetime); returns null if invalid. */
function parseIso(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a bounded window. `to` defaults to now; `from` defaults to `to − 12 months`. The span is clamped to
 * MAX_DAYS, and `from` is never after `to` (swapped/invalid input collapses to the default). `now` is injected.
 */
export function resolveWindow(fromRaw: string | undefined, toRaw: string | undefined, now: Date = new Date()): ResolvedWindow {
  const to = parseIso(toRaw) ?? now;
  const toMs = Math.min(to.getTime(), now.getTime() + DAY); // never far in the future
  let fromMs = parseIso(fromRaw)?.getTime() ?? toMs - DEFAULT_DAYS * DAY;
  if (fromMs > toMs) fromMs = toMs - DEFAULT_DAYS * DAY;      // invalid order → default span
  if (toMs - fromMs > MAX_DAYS * DAY) fromMs = toMs - MAX_DAYS * DAY; // clamp span
  return { fromIso: new Date(fromMs).toISOString(), toIso: new Date(toMs).toISOString() };
}
