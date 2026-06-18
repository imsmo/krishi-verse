// modules/labour/repositories/booking-assignment.repository.ts · all SQL for booking_assignments.
// tenant_id in EVERY query (Law 1) + RLS. No version column → mutations lock the row FOR UPDATE.
// UNIQUE(booking_id, worker_id) is the no-double-assign guard. Reads on replica; lists are keyset.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { BookingAssignment, BookingAssignmentProps } from '../domain/booking-assignment.entity';
import { AssignmentStatus } from '../domain/booking-assignment.state';

const COLS = `id, booking_id, tenant_id, worker_id, status, accepted_at, voice_consent_media_id, wage_minor, created_at`;
function toDomain(r: any): BookingAssignment {
  return BookingAssignment.rehydrate({
    id: r.id, bookingId: r.booking_id, tenantId: r.tenant_id, workerId: r.worker_id, status: r.status as AssignmentStatus,
    acceptedAt: r.accepted_at, voiceConsentMediaId: r.voice_consent_media_id, wageMinor: BigInt(r.wage_minor), createdAt: r.created_at,
  });
}
export interface AssignmentListQuery { workerId?: string; bookingId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class BookingAssignmentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, a: BookingAssignment): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `INSERT INTO booking_assignments (id, booking_id, tenant_id, worker_id, status, accepted_at, voice_consent_media_id, wage_minor, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$4)`,
      [p.id, p.bookingId, p.tenantId, p.workerId, p.status, p.acceptedAt, p.voiceConsentMediaId, p.wageMinor.toString()]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<BookingAssignment | null> {
    const r = await tx.query(`SELECT ${COLS} FROM booking_assignments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<BookingAssignment | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM booking_assignments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async findByBookingAndWorker(tx: TxContext, tenantId: string, bookingId: string, workerId: string): Promise<BookingAssignment | null> {
    const r = await tx.query(`SELECT ${COLS} FROM booking_assignments WHERE tenant_id=$1 AND booking_id=$2 AND worker_id=$3 AND deleted_at IS NULL`, [tenantId, bookingId, workerId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** All accepted assignments for a booking, LOCKED — drives the wage settlement (one payment per worker). */
  async listAcceptedForUpdate(tx: TxContext, tenantId: string, bookingId: string): Promise<BookingAssignment[]> {
    const r = await tx.query(`SELECT ${COLS} FROM booking_assignments WHERE tenant_id=$1 AND booking_id=$2 AND status='accepted' AND deleted_at IS NULL ORDER BY created_at FOR UPDATE`, [tenantId, bookingId]);
    return r.rows.map(toDomain);
  }
  /** Count of non-terminal assignments occupying a slot (pending/accepted) — the BookingFull guard. */
  async countActive(tx: TxContext, tenantId: string, bookingId: string): Promise<number> {
    const r = await tx.query(`SELECT count(*)::int n FROM booking_assignments WHERE tenant_id=$1 AND booking_id=$2 AND status IN ('pending_worker','accepted') AND deleted_at IS NULL`, [tenantId, bookingId]);
    return r.rows[0]?.n ?? 0;
  }
  async update(tx: TxContext, a: BookingAssignment): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `UPDATE booking_assignments SET status=$3, accepted_at=$4, voice_consent_media_id=$5, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.status, p.acceptedAt, p.voiceConsentMediaId]);
  }
  async listFor(tenantId: string, q: AssignmentListQuery): Promise<BookingAssignment[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.workerId) where += ` AND worker_id=${p(q.workerId)}`;
    if (q.bookingId) where += ` AND booking_id=${p(q.bookingId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM booking_assignments WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** Pending assignments for a booking, LOCKED — the respond-timeout job expires them with the booking. */
  async listPendingForUpdate(tx: TxContext, tenantId: string, bookingId: string): Promise<BookingAssignment[]> {
    const r = await tx.query(`SELECT ${COLS} FROM booking_assignments WHERE tenant_id=$1 AND booking_id=$2 AND status='pending_worker' AND deleted_at IS NULL FOR UPDATE`, [tenantId, bookingId]);
    return r.rows.map(toDomain);
  }
}
