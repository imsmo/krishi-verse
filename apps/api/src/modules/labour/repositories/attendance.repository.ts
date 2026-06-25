// modules/labour/repositories/attendance.repository.ts · all SQL for attendance_records (PRD §31.12).
// tenant_id in EVERY query (Law 1) + RLS (enabled by the auto-RLS pass in 0014; attendance_records owns a
// tenant_id column). The table is PARTITIONED BY RANGE(created_at) — partitions are kept ahead by the
// ensure_partitions() ops job, so a clock-in always lands on a live partition. The table has NO std columns
// (no created_by/updated_at/deleted_at) and NO version column; the one-per-day rule is enforced in-service
// under the booking-assignment write lock (and backstopped by UNIQUE(assignment_id, work_date, created_at)).
import { Inject, Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

export interface ClockInRow {
  id: string; tenantId: string; assignmentId: string; workDate: string;
  clockInAt: Date; clockInLat: number; clockInLng: number; clockInDistanceM: number; clockInMethod: string;
}

/** A full attendance day row (the lifecycle facts the state machine derives status from). */
export interface AttendanceDay {
  id: string; createdAt: Date; assignmentId: string; workDate: string;
  clockInAt: Date | null; clockOutAt: Date | null; breakMinutes: number;
  hoursRegular: number | null; hoursOvertime: number; confirmedByEmployer: boolean;
}

/** One row of a worker's work-history (joined to its booking for context). hours are read-only display. */
export interface WorkHistoryRow extends AttendanceDay { bookingId: string; wagePayoutId: string | null; }

const ymd = (v: any): string => (typeof v === 'string' ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10));
const toDay = (r: any): AttendanceDay => ({
  id: r.id, createdAt: r.created_at, assignmentId: r.assignment_id, workDate: ymd(r.work_date),
  clockInAt: r.clock_in_at, clockOutAt: r.clock_out_at, breakMinutes: Number(r.break_minutes),
  hoursRegular: r.hours_regular === null ? null : Number(r.hours_regular), hoursOvertime: Number(r.hours_overtime),
  confirmedByEmployer: r.confirmed_by_employer,
});

@Injectable()
export class AttendanceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Does the assignment already have an attendance row for this work date? (the double-clock-in guard). */
  async findForDay(tx: TxContext, tenantId: string, assignmentId: string, workDate: string): Promise<{ id: string } | null> {
    const r = await tx.query(
      `SELECT id FROM attendance_records WHERE tenant_id=$1 AND assignment_id=$2 AND work_date=$3 LIMIT 1`,
      [tenantId, assignmentId, workDate]);
    return r.rows[0] ? { id: r.rows[0].id } : null;
  }

  /** Insert the clock-in. distance_m + method are SERVER-computed/SERVER-set — never taken from the client. */
  async insertClockIn(tx: TxContext, row: ClockInRow): Promise<void> {
    await tx.query(
      `INSERT INTO attendance_records (id, tenant_id, assignment_id, work_date, clock_in_at, clock_in_lat,
         clock_in_lng, clock_in_distance_m, clock_in_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id, row.tenantId, row.assignmentId, row.workDate, row.clockInAt, row.clockInLat, row.clockInLng,
       row.clockInDistanceM, row.clockInMethod]);
  }

  /** The full day row for an assignment + date (serialized in-service under the assignment write-lock). */
  async getDay(tx: TxContext, tenantId: string, assignmentId: string, workDate: string): Promise<AttendanceDay | null> {
    const r = await tx.query(
      `SELECT id, created_at, assignment_id, work_date, clock_in_at, clock_out_at, break_minutes,
              hours_regular, hours_overtime, confirmed_by_employer
       FROM attendance_records WHERE tenant_id=$1 AND assignment_id=$2 AND work_date=$3 LIMIT 1`,
      [tenantId, assignmentId, workDate]);
    return r.rows[0] ? toDay(r.rows[0]) : null;
  }

  /** Finalise the day: clock_out + SERVER-computed hours/overtime. Guarded by clock_out_at IS NULL so a
   *  concurrent/replayed clock-out is a no-op (rowCount 0). PK (id, created_at) keeps PG to one partition. */
  async updateClockOut(tx: TxContext, p: { id: string; createdAt: Date; tenantId: string; clockOutAt: Date; breakMinutes: number; hoursRegular: number; hoursOvertime: number }): Promise<number> {
    const r = await tx.query(
      `UPDATE attendance_records SET clock_out_at=$4, break_minutes=$5, hours_regular=$6, hours_overtime=$7
       WHERE id=$1 AND created_at=$2 AND tenant_id=$3 AND clock_out_at IS NULL`,
      [p.id, p.createdAt, p.tenantId, p.clockOutAt, p.breakMinutes, p.hoursRegular, p.hoursOvertime]);
    return r.rowCount ?? 0;
  }

  /** Employer dual-confirm. Guarded by confirmed_by_employer=false (idempotent) AND clock_out_at NOT NULL
   *  (cannot confirm a day whose hours aren't finalised — the service also asserts the state transition). */
  async updateConfirm(tx: TxContext, p: { id: string; createdAt: Date; tenantId: string }): Promise<number> {
    const r = await tx.query(
      `UPDATE attendance_records SET confirmed_by_employer=true
       WHERE id=$1 AND created_at=$2 AND tenant_id=$3 AND confirmed_by_employer=false AND clock_out_at IS NOT NULL`,
      [p.id, p.createdAt, p.tenantId]);
    return r.rowCount ?? 0;
  }

  /** A worker's work-history (newest first), keyset on (created_at,id). Joined to the assignment to filter by
   *  worker + expose the booking id. Replica read (CQRS); never OFFSET. */
  async listForWorker(tenantId: string, workerId: string, opts: { cursor?: { c: string; id: string }; limit: number }): Promise<WorkHistoryRow[]> {
    const params: unknown[] = [tenantId, workerId];
    let where = `ar.tenant_id=$1 AND ba.worker_id=$2`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (opts.cursor) { const cc = p(opts.cursor.c), ci = p(opts.cursor.id); where += ` AND (ar.created_at < ${cc} OR (ar.created_at=${cc} AND ar.id < ${ci}))`; }
    const lp = p(opts.limit);
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ar.id, ar.created_at, ar.assignment_id, ba.booking_id, ar.work_date, ar.clock_in_at, ar.clock_out_at,
              ar.break_minutes, ar.hours_regular, ar.hours_overtime, ar.confirmed_by_employer, ar.wage_payout_id
       FROM attendance_records ar
       JOIN booking_assignments ba ON ba.id = ar.assignment_id AND ba.tenant_id = ar.tenant_id
       WHERE ${where} ORDER BY ar.created_at DESC, ar.id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ ...toDay(x), bookingId: x.booking_id, wagePayoutId: x.wage_payout_id }));
  }
}
