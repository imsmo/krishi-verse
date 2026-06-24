// modules/labour/services/attendance.service.ts · the worker clock-in (geo-fenced attendance, PRD §31.12).
// THE FENCE IS SERVER-SIDE: the device sends only its raw GPS fix; the server re-resolves the booking's farm
// coordinates, computes the great-circle distance itself (domain/geo.ts), and REFUSES a clock-in farther than
// ATTENDANCE_FENCE_M — the client cannot forge proximity. Ownership is re-resolved from the token (the caller's
// own worker profile, anti-IDOR); a worker may only clock in on an assignment that is theirs AND 'accepted'.
// One ACID tx (UoW) under the assignment write-lock, idempotent on the caller's key (Law 3), one row per
// assignment per day (backstopped by attendance_records' UNIQUE(assignment_id, work_date, created_at)), event
// drained to the outbox in-tx (Law 4). No money moves here (wages settle later via payWages).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { distanceMeters, ATTENDANCE_FENCE_M } from '../domain/geo';
import { LabourEventType } from '../domain/labour.events';
import { BookingAssignmentRepository } from '../repositories/booking-assignment.repository';
import { WorkerProfileRepository } from '../repositories/worker-profile.repository';
import { LabourBookingRepository } from '../repositories/labour-booking.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import {
  AssignmentNotFoundError, WorkerProfileNotFoundError, LabourForbiddenError,
  BookingNotFoundError, AssignmentNotAcceptedError, OutOfFenceError, AlreadyClockedInError,
} from '../domain/labour.errors';

const workDateOf = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly assignments: BookingAssignmentRepository,
    private readonly workers: WorkerProfileRepository,
    private readonly bookings: LabourBookingRepository,
    private readonly attendance: AttendanceRepository,
  ) {}

  /** WORKER clocks in for today on their OWN accepted assignment, proving they are within the farm fence. */
  async clockIn(tenantId: string, userId: string, assignmentId: string, fix: { lat: number; lng: number }, idemKey: string) {
    return this.idem.remember(idemKey, userId, 'labour.attendance.clock_in', () =>
      timed(this.metrics, 'labour.attendance.clock_in', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const assignment = await this.assignments.getForUpdate(tx, tenantId, assignmentId);   // lock the assignment row
          if (!assignment) throw new AssignmentNotFoundError(assignmentId);
          const mine = await this.workers.findByUser(tenantId, userId, tx);                     // the caller's OWN profile (anti-IDOR)
          if (!mine || mine.id !== assignment.workerId) throw new LabourForbiddenError('only the assigned worker may clock in');
          if (assignment.status !== 'accepted') throw new AssignmentNotAcceptedError(assignment.status);

          const booking = await this.bookings.getById(tenantId, assignment.bookingId, tx);
          if (!booking) throw new BookingNotFoundError(assignment.bookingId);
          const b = booking.toProps();
          const distanceM = distanceMeters(fix.lat, fix.lng, b.farmLat, b.farmLng);             // SERVER-computed fence proof
          if (distanceM > ATTENDANCE_FENCE_M) throw new OutOfFenceError(distanceM, ATTENDANCE_FENCE_M);

          const now = new Date();
          const workDate = workDateOf(now);
          if (await this.attendance.findForDay(tx, tenantId, assignmentId, workDate)) throw new AlreadyClockedInError();

          const id = uuidv7();
          await this.attendance.insertClockIn(tx, {
            id, tenantId, assignmentId, workDate, clockInAt: now,
            clockInLat: fix.lat, clockInLng: fix.lng, clockInDistanceM: distanceM, clockInMethod: 'self',
          });
          await this.outbox.write(tx, {
            tenantId, aggregateType: 'attendance_record', aggregateId: id, eventType: LabourEventType.AttendanceClockedIn,
            payload: { v: 1, attendanceId: id, assignmentId, bookingId: assignment.bookingId, workerId: mine.id, workDate, distanceM },
          });
          return { id, assignmentId, bookingId: assignment.bookingId, workDate, clockInAt: now.toISOString(), distanceM, method: 'self' };
        }, { userId })));
  }
}
