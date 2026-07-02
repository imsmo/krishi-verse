// apps/mobile/src/features/labour/availability-calendar.ts · PURE month-calendar logic for the worker "Set
// Availability" screen (screen 36). No React / no SDK I/O → unit-tested. Builds a Monday-first month grid, resolves
// each day's state, counts the legend buckets, and generates the quick-action selections. All dates are UTC
// yyyy-mm-dd strings so they compare/serialise deterministically.
//
// NOTE (§13): there is NO availability endpoint in the labour contract yet, so the *available* selection this
// module manages is LOCAL only — the screen flags "Save" as not-yet-syncing rather than faking a persisted write.
// The *booked* set, by contrast, is REAL (derived from the worker's confirmed bookings) and is never editable here.

export interface DayCell { day: number; iso: string }
export type DayState = 'past' | 'booked' | 'available' | 'off';

const pad = (n: number): string => String(n).padStart(2, '0');

/** UTC yyyy-mm-dd for a given calendar day. Pure. */
export function isoOf(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

/** Monday-first weekday column (0=Mon … 6=Sun) for a yyyy-mm-dd. Pure. */
export function mondayIndex(iso: string): number {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  return (dow + 6) % 7;
}

/** The days of a month as cells. Pure. */
export function monthDays(year: number, month0: number): DayCell[] {
  const count = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const out: DayCell[] = [];
  for (let d = 1; d <= count; d++) out.push({ day: d, iso: isoOf(year, month0, d) });
  return out;
}

/** A Monday-first week matrix: rows of 7, padded with nulls before the 1st and after the last. Pure. */
export function monthMatrix(year: number, month0: number): (DayCell | null)[][] {
  const days = monthDays(year, month0);
  const lead = days.length ? mondayIndex(days[0].iso) : 0;
  const cells: (DayCell | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A single day's state. Precedence: booked (real, immutable) → available (selected) → past → off. Pure. */
export function dayState(iso: string, booked: ReadonlySet<string>, available: ReadonlySet<string>, todayIso: string): DayState {
  if (booked.has(iso)) return 'booked';
  if (available.has(iso)) return 'available';
  if (iso < todayIso) return 'past';
  return 'off';
}

export interface AvailabilityCounts { available: number; booked: number; off: number }
/** Legend counts across the month: available (selected & not booked), booked, and everything else (off/past). Pure. */
export function counts(year: number, month0: number, booked: ReadonlySet<string>, available: ReadonlySet<string>): AvailabilityCounts {
  let a = 0, b = 0;
  for (const { iso } of monthDays(year, month0)) {
    if (booked.has(iso)) b += 1;
    else if (available.has(iso)) a += 1;
  }
  const total = monthDays(year, month0).length;
  return { available: a, booked: b, off: total - a - b };
}

/** Toggle one day in a selection set (returns a NEW set). Booked/past days can't be selected. Pure. */
export function toggleDay(available: ReadonlySet<string>, iso: string): Set<string> {
  const next = new Set(available);
  if (next.has(iso)) next.delete(iso); else next.add(iso);
  return next;
}

export type QuickAction = 'weekdays' | 'skipSundays' | 'next7' | 'clear';

/** Generate the available-day selection for a quick action over the month, always excluding booked days and past
 * days (you can't offer availability in the past or on a confirmed booking). Returns a NEW set. Pure. */
export function applyQuickAction(action: QuickAction, year: number, month0: number, booked: ReadonlySet<string>, todayIso: string, nowMs: number = Date.now()): Set<string> {
  if (action === 'clear') return new Set();
  const out = new Set<string>();
  const selectable = (iso: string) => !booked.has(iso) && iso >= todayIso;
  if (action === 'next7') {
    for (let i = 0; i < 7; i++) {
      const iso = new Date(nowMs + i * 86400000).toISOString().slice(0, 10);
      if (iso.slice(0, 7) === `${year}-${pad(month0 + 1)}` && selectable(iso)) out.add(iso);
    }
    return out;
  }
  for (const { iso } of monthDays(year, month0)) {
    if (!selectable(iso)) continue;
    const col = mondayIndex(iso); // 0=Mon … 6=Sun
    if (action === 'weekdays' && col <= 4) out.add(iso);       // Mon–Fri
    else if (action === 'skipSundays' && col <= 5) out.add(iso); // Mon–Sat
  }
  return out;
}
