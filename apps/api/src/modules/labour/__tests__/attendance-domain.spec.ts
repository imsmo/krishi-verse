// modules/labour/__tests__/attendance-domain.spec.ts · the attendance day domain (pure: hours/overtime +
// derived state machine). No DB, no money.
import { computeHours, STANDARD_WORKDAY_MIN } from '../domain/hours';
import { deriveStatus, canTransition, assertTransition, isConfirmed, IllegalAttendanceTransitionError } from '../domain/attendance.state';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 1, h, m, 0));

describe('computeHours', () => {
  it('an exactly-standard shift is all regular, zero overtime', () => {
    const r = computeHours({ clockInAt: at(8), clockOutAt: at(16), breakMinutes: 0 }); // 8h
    expect(r.workedMinutes).toBe(480);
    expect(r.hoursRegular).toBe(8);
    expect(r.hoursOvertime).toBe(0);
  });

  it('subtracts the paid-out break before computing hours', () => {
    const r = computeHours({ clockInAt: at(8), clockOutAt: at(17), breakMinutes: 60 }); // 9h gross − 1h break = 8h
    expect(r.workedMinutes).toBe(480);
    expect(r.hoursRegular).toBe(8);
    expect(r.hoursOvertime).toBe(0);
  });

  it('splits anything beyond the standard workday into overtime', () => {
    const r = computeHours({ clockInAt: at(7), clockOutAt: at(18), breakMinutes: 30 }); // 11h − 0.5h = 10.5h
    expect(r.hoursRegular).toBe(8);
    expect(r.hoursOvertime).toBe(2.5);
  });

  it('rounds to 2 decimals (numeric(4,2))', () => {
    const r = computeHours({ clockInAt: at(8), clockOutAt: at(8, 50), breakMinutes: 0 }); // 50 min
    expect(r.hoursRegular).toBe(0.83);
  });

  it('clamps a negative/zero span to 0 (never negative hours)', () => {
    const r = computeHours({ clockInAt: at(16), clockOutAt: at(8), breakMinutes: 0 });
    expect(r.workedMinutes).toBe(0);
    expect(r.hoursRegular).toBe(0);
    expect(r.hoursOvertime).toBe(0);
  });

  it('a break longer than the shift yields zero worked time, not negative', () => {
    const r = computeHours({ clockInAt: at(8), clockOutAt: at(9), breakMinutes: 120 });
    expect(r.workedMinutes).toBe(0);
  });

  it('caps a single day at 24h', () => {
    const r = computeHours({ clockInAt: at(0), clockOutAt: new Date(Date.UTC(2026, 5, 3, 0, 0, 0)), breakMinutes: 0 }); // 48h span
    expect(r.workedMinutes).toBe(24 * 60);
    expect(r.hoursOvertime).toBe(24 - STANDARD_WORKDAY_MIN / 60);
  });
});

describe('attendance.state', () => {
  it('derives status from the persisted facts', () => {
    expect(deriveStatus({ clockInAt: at(8), clockOutAt: null, confirmedByEmployer: false })).toBe('clocked_in');
    expect(deriveStatus({ clockInAt: at(8), clockOutAt: at(16), confirmedByEmployer: false })).toBe('clocked_out');
    expect(deriveStatus({ clockInAt: at(8), clockOutAt: at(16), confirmedByEmployer: true })).toBe('confirmed');
  });

  it('only allows clocked_in→clocked_out→confirmed', () => {
    expect(canTransition('clocked_in', 'clocked_out')).toBe(true);
    expect(canTransition('clocked_out', 'confirmed')).toBe(true);
    expect(canTransition('clocked_in', 'confirmed')).toBe(false);   // cannot confirm before clock-out
    expect(canTransition('confirmed', 'clocked_out')).toBe(false);  // confirmed is terminal/immutable
    expect(isConfirmed('confirmed')).toBe(true);
  });

  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('clocked_in', 'confirmed')).toThrow(IllegalAttendanceTransitionError);
    expect(() => assertTransition('confirmed', 'clocked_out')).toThrow(IllegalAttendanceTransitionError);
  });
});
