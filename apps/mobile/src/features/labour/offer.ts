// apps/mobile/src/features/labour/offer.ts · PURE logic for the worker job-offer (screen 27). No React/native
// deps → unit-tested. Money is bigint minor-unit strings (Law 2) — the "above minimum wage" delta is BigInt.

/** The accept/decline window from the booking's respondBy deadline. `expired` once now ≥ deadline; else the
 * remaining whole hours + minutes (never negative). The SERVER is the authority on the window (a late accept 409s);
 * this only drives the countdown UI. null respondBy → no deadline shown. Pure. */
export function respondWindow(respondByIso: string | null | undefined, nowMs: number = Date.now()): { expired: boolean; hoursLeft: number; minutesLeft: number } | null {
  if (!respondByIso) return null;
  const end = new Date(respondByIso).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - nowMs;
  if (ms <= 0) return { expired: true, hoursLeft: 0, minutesLeft: 0 };
  const totalMin = Math.floor(ms / 60000);
  return { expired: false, hoursLeft: Math.floor(totalMin / 60), minutesLeft: totalMin % 60 };
}

/** How far the offered wage sits ABOVE the statutory minimum snapshotted on the booking = offered − min, when
 * positive; null otherwise (or bad input). Both bigint-minor strings. Drives "✓ ₹X above state minimum". Pure. */
export function wageAboveMinMinor(offeredMinor: string, minMinor: string): string | null {
  try {
    const offered = BigInt(offeredMinor); const min = BigInt(minMinor);
    return offered > min ? (offered - min).toString() : null;
  } catch { return null; }
}

/** "N people (you + N−1)" breakdown for the worker offer's "workers needed" row (screen 141). `others` is how many
 * beyond the offered worker. Clamped at ≥1 total. Pure — the count is REAL from the booking (workersNeeded). */
export function workersNeeded(total: number | null | undefined): { total: number; others: number } {
  const n = Number.isInteger(total) && (total as number) > 0 ? (total as number) : 1;
  return { total: n, others: Math.max(0, n - 1) };
}
