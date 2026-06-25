// modules/labour/domain/hours.ts · PURE worked-hours / overtime computation for a day's attendance (no I/O).
// Worked minutes = (clock_out − clock_in) − paid-out break, clamped ≥ 0. The statutory standard workday is
// STANDARD_WORKDAY_MIN (8h, PRD §31.13); anything beyond it is OVERTIME. Returns hours as numbers rounded to
// 2 decimals (the DB columns are numeric(4,2)). Wage MONEY is NOT computed here — it settles only through the
// ledger (Law 2); these hours are an auditable input to that settlement, never a balance.
export const STANDARD_WORKDAY_MIN = 8 * 60;   // 480 — one statutory shift
export const MAX_WORKDAY_MIN = 24 * 60;       // hard cap (a single day's record can't exceed 24h)

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ComputedHours { workedMinutes: number; hoursRegular: number; hoursOvertime: number; }

/** Compute regular + overtime hours for one day. Throws-free: callers validate clockOut > clockIn first
 *  (ClockOutBeforeClockInError) — here we clamp defensively so a bad pair can never produce negative hours. */
export function computeHours(input: { clockInAt: Date; clockOutAt: Date; breakMinutes?: number; standardMin?: number }): ComputedHours {
  const standard = input.standardMin ?? STANDARD_WORKDAY_MIN;
  const grossMin = Math.max(0, Math.round((input.clockOutAt.getTime() - input.clockInAt.getTime()) / 60_000));
  const brk = Math.max(0, Math.floor(input.breakMinutes ?? 0));
  const worked = Math.min(Math.max(0, grossMin - brk), MAX_WORKDAY_MIN);   // clamp into [0, 24h]
  const regularMin = Math.min(worked, standard);
  const overtimeMin = Math.max(0, worked - standard);
  return { workedMinutes: worked, hoursRegular: round2(regularMin / 60), hoursOvertime: round2(overtimeMin / 60) };
}
