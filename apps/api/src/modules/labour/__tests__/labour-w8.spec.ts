// modules/labour/__tests__/labour-w8.spec.ts · pure-domain unit tests for API-W8 (self-apply + attendance geofence).
// No infra: the geofence math (domain/geo.ts), the 'applied' interest-pool transition, and the
// BookingAssignment.apply factory + its event. The server-side fence is the security boundary; we pin its
// distance maths and the ≤100m threshold so a regression can't silently widen the fence.
import { distanceMeters, ATTENDANCE_FENCE_M } from '../domain/geo';
import { canTransition as aCan, ASSIGNMENT_STATUSES, AssignmentStatus } from '../domain/booking-assignment.state';
import { BookingAssignment } from '../domain/booking-assignment.entity';
import { LabourEventType } from '../domain/labour.events';

describe('geo.distanceMeters — the attendance fence math', () => {
  it('is zero at the same point', () => {
    expect(distanceMeters(22.3, 71.1, 22.3, 71.1)).toBe(0);
  });
  it('is symmetric', () => {
    expect(distanceMeters(22.3, 71.1, 22.301, 71.101)).toBe(distanceMeters(22.301, 71.101, 22.3, 71.1));
  });
  it('returns a rounded integer metre count', () => {
    const d = distanceMeters(22.3, 71.1, 22.3009, 71.1);
    expect(Number.isInteger(d)).toBe(true);
  });
  it('~111m per 0.001° of latitude (a point just outside the 100m fence)', () => {
    const d = distanceMeters(22.3, 71.1, 22.301, 71.1);   // ≈111m north
    expect(d).toBeGreaterThan(ATTENDANCE_FENCE_M);          // would be REJECTED
    expect(d).toBeGreaterThan(100); expect(d).toBeLessThan(125);
  });
  it('a point ~55m away is inside the fence', () => {
    const d = distanceMeters(22.3, 71.1, 22.3005, 71.1);   // ≈55m
    expect(d).toBeLessThanOrEqual(ATTENDANCE_FENCE_M);      // would be ACCEPTED
  });
  it('the fence is exactly 100 metres', () => { expect(ATTENDANCE_FENCE_M).toBe(100); });
});

describe("assignment.state — the 'applied' interest pool", () => {
  it('applied → accepted/rejected/expired', () => {
    expect(aCan('applied', 'accepted')).toBe(true);
    expect(aCan('applied', 'rejected')).toBe(true);
    expect(aCan('applied', 'expired')).toBe(true);
  });
  it('applied cannot jump straight to paid', () => { expect(aCan('applied', 'paid')).toBe(false); });
  it("'applied' is a known status", () => { expect(ASSIGNMENT_STATUSES).toContain('applied' as AssignmentStatus); });
  it('every status enumerates without throwing', () => { for (const s of ASSIGNMENT_STATUSES) expect(() => aCan(s, 'expired' as AssignmentStatus)).not.toThrow(); });
});

describe('BookingAssignment.apply — worker self-apply factory', () => {
  it("creates an 'applied' assignment carrying the booking's offered wage + emits worker_assigned(applied)", () => {
    const a = BookingAssignment.apply({ id: 'a1', bookingId: 'b1', tenantId: 't1', workerId: 'w1', wageMinor: 50000n });
    expect(a.status).toBe('applied');
    expect(a.toProps().wageMinor).toBe(50000n);
    expect(a.toProps().acceptedAt).toBeNull();
    const ev = a.pullEvents();
    expect(ev.map((e) => e.type)).toContain(LabourEventType.WorkerAssigned);
    expect(ev.find((e) => e.type === LabourEventType.WorkerAssigned)?.payload.applied).toBe(true);
  });
});
