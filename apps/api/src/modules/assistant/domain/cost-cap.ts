// modules/assistant/domain/cost-cap.ts · PURE per-user cost/rate-cap decision (no I/O → unit-tested).
// A governed model call costs money + invites abuse, so each farmer is bounded on two windows: a burst cap
// (per minute) and a budget cap (per rolling day). The repo supplies the observed counts in each window; this
// fn decides allow/deny + which limit tripped, so the service can throw a typed 429 with a stable reason.

/** DI token for the resolved per-user caps (bound from AppConfig in the module). */
export const ASSISTANT_CAPS = Symbol('ASSISTANT_CAPS');

export interface CapCounts { perMinute: number; perDay: number; }
export interface CapLimits { perMinuteCap: number; dailyCap: number; }
export type CapDecision = { allowed: true } | { allowed: false; limit: 'per_minute' | 'per_day' };

/** Decide whether one more message is allowed. Counts are PRIOR usage in each window (this call not yet counted).
 *  Burst cap is checked first (cheaper to trip), then the daily budget. */
export function decideCap(counts: CapCounts, limits: CapLimits): CapDecision {
  if (counts.perMinute >= limits.perMinuteCap) return { allowed: false, limit: 'per_minute' };
  if (counts.perDay >= limits.dailyCap) return { allowed: false, limit: 'per_day' };
  return { allowed: true };
}

/** Remaining messages in the daily budget (never negative) — for an `X-RateLimit-Remaining`-style hint. */
export function dailyRemaining(counts: CapCounts, limits: CapLimits): number {
  return Math.max(0, limits.dailyCap - counts.perDay);
}
