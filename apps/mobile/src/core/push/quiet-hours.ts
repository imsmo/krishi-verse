// apps/mobile/src/core/push/quiet-hours.ts · PURE quiet-hours math (no I/O) — used to suppress LOCAL foreground
// notification display during the user's quiet window (the server also respects quiet hours for actual push
// delivery). Handles windows that wrap past midnight (e.g. 22:00–06:00). Unit-tested.

/** Parse "HH:MM" (or "HH:MM:SS") to minutes-of-day, or null if malformed. */
export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** True if `nowMin` (0..1439) falls inside the quiet window [start,end). A zero-length window = never quiet. */
export function isWithinQuietMinutes(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;   // same-day window
  return nowMin >= startMin || nowMin < endMin;                          // wraps past midnight
}

/** Convenience: is `now` within the quiet window given as "HH:MM" strings? Bad input → not quiet (fail open for
 * display only — the server still gates real delivery). */
export function isWithinQuietHours(now: Date, starts: string, ends: string): boolean {
  const s = hhmmToMinutes(starts); const e = hhmmToMinutes(ends);
  if (s === null || e === null) return false;
  return isWithinQuietMinutes(now.getHours() * 60 + now.getMinutes(), s, e);
}
