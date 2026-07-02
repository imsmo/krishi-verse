// Unit tests for the PURE availability-calendar logic (screen 36).
import { isoOf, mondayIndex, monthDays, monthMatrix, dayState, counts, toggleDay, applyQuickAction } from '../../features/labour/availability-calendar';

describe('availability calendar (screen 36)', () => {
  it('isoOf zero-pads', () => {
    expect(isoOf(2026, 7, 5)).toBe('2026-08-05'); // month0=7 → August
    expect(isoOf(2026, 0, 1)).toBe('2026-01-01');
  });
  it('mondayIndex: Aug 1 2026 is a Saturday → col 5', () => {
    expect(mondayIndex('2026-08-01')).toBe(5);
    expect(mondayIndex('2026-08-03')).toBe(0); // Monday
    expect(mondayIndex('2026-08-02')).toBe(6); // Sunday
  });
  it('monthDays returns all days; August has 31', () => {
    const d = monthDays(2026, 7);
    expect(d).toHaveLength(31);
    expect(d[0].iso).toBe('2026-08-01');
    expect(d[30].iso).toBe('2026-08-31');
  });
  it('monthMatrix rows of 7, leading nulls before the 1st', () => {
    const m = monthMatrix(2026, 7);
    expect(m.every((w) => w.length === 7)).toBe(true);
    expect(m[0].slice(0, 5).every((c) => c === null)).toBe(true); // 5 leading blanks (Sat start)
    expect(m[0][5]?.day).toBe(1);
  });
  it('dayState precedence: booked > available > past > off', () => {
    const booked = new Set(['2026-08-15']);
    const avail = new Set(['2026-08-16']);
    const today = '2026-08-14';
    expect(dayState('2026-08-15', booked, avail, today)).toBe('booked');
    expect(dayState('2026-08-16', booked, avail, today)).toBe('available');
    expect(dayState('2026-08-10', booked, avail, today)).toBe('past');
    expect(dayState('2026-08-20', booked, avail, today)).toBe('off');
  });
  it('counts: available excludes booked; off = rest', () => {
    const booked = new Set(['2026-08-15', '2026-08-16']);
    const avail = new Set(['2026-08-16', '2026-08-20', '2026-08-21']); // 16 is booked → not counted available
    const c = counts(2026, 7, booked, avail);
    expect(c.booked).toBe(2);
    expect(c.available).toBe(2);
    expect(c.off).toBe(31 - 2 - 2);
  });
  it('toggleDay adds then removes (new set each time)', () => {
    const a = toggleDay(new Set(), '2026-08-20');
    expect(a.has('2026-08-20')).toBe(true);
    const b = toggleDay(a, '2026-08-20');
    expect(b.has('2026-08-20')).toBe(false);
  });
  it('quick actions exclude booked + past; weekdays=Mon–Fri, skipSundays=Mon–Sat, clear empties', () => {
    const booked = new Set(['2026-08-17']); // a Monday
    const today = '2026-08-01';
    const wk = applyQuickAction('weekdays', 2026, 7, booked, today);
    expect(wk.has('2026-08-17')).toBe(false);       // booked excluded
    expect(wk.has('2026-08-18')).toBe(true);         // Tue
    expect(wk.has('2026-08-16')).toBe(false);        // Sunday excluded from weekdays
    const ss = applyQuickAction('skipSundays', 2026, 7, booked, today);
    expect(ss.has('2026-08-22')).toBe(true);         // Saturday included
    expect(ss.has('2026-08-16')).toBe(false);        // Sunday excluded
    expect(applyQuickAction('clear', 2026, 7, booked, today).size).toBe(0);
  });
  it('next7 stays within the month and skips past/booked', () => {
    const now = Date.parse('2026-08-28T00:00:00Z');
    const s = applyQuickAction('next7', 2026, 7, new Set(), '2026-08-28', now);
    // Aug 28,29,30,31 in-month; Sep 1-3 excluded
    expect([...s].sort()).toEqual(['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31']);
  });
});
