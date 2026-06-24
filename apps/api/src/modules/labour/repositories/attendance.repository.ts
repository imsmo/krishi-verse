// modules/labour/repositories/attendance.repository.ts · all SQL for attendance_records (PRD §31.12).
// tenant_id in EVERY query (Law 1) + RLS (enabled by the auto-RLS pass in 0014; attendance_records owns a
// tenant_id column). The table is PARTITIONED BY RANGE(created_at) — partitions are kept ahead by the
// ensure_partitions() ops job, so a clock-in always lands on a live partition. The table has NO std columns
// (no created_by/updated_at/deleted_at) and NO version column; the one-per-day rule is enforced in-service
// under the booking-assignment write lock (and backstopped by UNIQUE(assignment_id, work_date, created_at)).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';

export interface ClockInRow {
  id: string; tenantId: string; assignmentId: string; workDate: string;
  clockInAt: Date; clockInLat: number; clockInLng: number; clockInDistanceM: number; clockInMethod: string;
}

@Injectable()
export class AttendanceRepository {
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
}
