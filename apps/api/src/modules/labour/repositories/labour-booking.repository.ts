// modules/labour/repositories/labour-booking.repository.ts · all SQL for labour_bookings.
// tenant_id in EVERY query (Law 1) + RLS. labour_bookings HAS a version column → mutations are an
// OPTIMISTIC compare-and-swap on version (lost-update protection at billions of writes); reads on replica;
// lists are keyset (never OFFSET); the expiry finder is bounded + SKIP LOCKED.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LabourBooking, LabourBookingProps } from '../domain/labour-booking.entity';
import { BookingStatus } from '../domain/labour-booking.state';
import { WageKind } from '../domain/labour.events';
import { BookingConcurrencyError, InvalidDemandTypeError, SkillNotFoundError } from '../domain/labour.errors';

const COLS = `id, tenant_id, booking_no, employer_user_id, demand_type_id, task_skill_id, workers_needed,
  start_date, end_date, daily_hours, wage_kind, wage_offered_minor, min_wage_minor, currency_code,
  overtime_rate_multiplier, women_only, farm_lat, farm_lng, status, respond_by, version, created_at`;
const d = (v: any): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): LabourBooking {
  return LabourBooking.rehydrate({
    id: r.id, tenantId: r.tenant_id, bookingNo: r.booking_no, employerUserId: r.employer_user_id,
    demandTypeId: r.demand_type_id, taskSkillId: r.task_skill_id, workersNeeded: r.workers_needed,
    startDate: d(r.start_date), endDate: d(r.end_date), dailyHours: Number(r.daily_hours), wageKind: r.wage_kind as WageKind,
    wageOfferedMinor: BigInt(r.wage_offered_minor), minWageMinor: BigInt(r.min_wage_minor), currencyCode: r.currency_code,
    overtimeRateMultiplier: Number(r.overtime_rate_multiplier), womenOnly: r.women_only, farmLat: Number(r.farm_lat),
    farmLng: Number(r.farm_lng), status: r.status as BookingStatus, respondBy: r.respond_by, version: r.version, createdAt: r.created_at,
  });
}
export interface BookingListQuery { employerUserId?: string; openOnly?: boolean; status?: string; taskSkillId?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class LabourBookingRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, b: LabourBooking): Promise<void> {
    const p = b.toProps();
    await tx.query(
      `INSERT INTO labour_bookings (id, tenant_id, booking_no, employer_user_id, demand_type_id, task_skill_id,
         workers_needed, start_date, end_date, daily_hours, wage_kind, wage_offered_minor, min_wage_minor,
         currency_code, overtime_rate_multiplier, women_only, farm_lat, farm_lng, status, respond_by, version, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [p.id, p.tenantId, p.bookingNo, p.employerUserId, p.demandTypeId, p.taskSkillId, p.workersNeeded, p.startDate,
       p.endDate, p.dailyHours, p.wageKind, p.wageOfferedMinor.toString(), p.minWageMinor.toString(), p.currencyCode,
       p.overtimeRateMultiplier, p.womenOnly, p.farmLat, p.farmLng, p.status, p.respondBy, p.version, p.employerUserId]);
  }
  /** Lock-free read for marketplace/detail. */
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<LabourBooking | null> {
    const sql = `SELECT ${COLS} FROM labour_bookings WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Read within the tx for a mutation; the OPTIMISTIC version guard in update() is the lost-update defence. */
  async getForWrite(tx: TxContext, tenantId: string, id: string): Promise<LabourBooking | null> {
    const r = await tx.query(`SELECT ${COLS} FROM labour_bookings WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Optimistic compare-and-swap on version. Throws BookingConcurrencyError if another writer won. */
  async update(tx: TxContext, b: LabourBooking, expectedVersion: number): Promise<void> {
    const p = b.toProps();
    const r = await tx.query(
      `UPDATE labour_bookings SET status=$3, respond_by=$4, version=version+1, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND version=$5 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.status, p.respondBy, expectedVersion]);
    if (r.rowCount === 0) throw new BookingConcurrencyError(p.id);
  }
  async listFor(tenantId: string, q: BookingListQuery): Promise<LabourBooking[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.employerUserId) where += ` AND employer_user_id=${p(q.employerUserId)}`;
    if (q.openOnly) where += ` AND status='open'`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.taskSkillId) where += ` AND task_skill_id=${p(q.taskSkillId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM labour_bookings WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** Worker job (cross-tenant; kv_relay). Open bookings past respond_by, bounded + SKIP LOCKED. */
  async findDueToExpire(tx: TxContext, now: Date, limit: number): Promise<LabourBooking[]> {
    const r = await tx.query(
      `SELECT ${COLS} FROM labour_bookings WHERE status='open' AND respond_by IS NOT NULL AND respond_by < $1
        ORDER BY respond_by LIMIT $2 FOR UPDATE SKIP LOCKED`, [now, limit]);
    return r.rows.map(toDomain);
  }

  /** Resolve a labour_demand_type lookup CODE → its platform lookup_values id (anti-IDOR; not client id). */
  async resolveDemandTypeId(tx: TxContext, code: string): Promise<string> {
    const r = await tx.query(`SELECT id FROM lookup_values WHERE type_code='labour_demand_type' AND code=$1 AND tenant_id IS NULL AND is_active=true`, [code]);
    if (!r.rows[0]) throw new InvalidDemandTypeError(code);
    return r.rows[0].id;
  }
  /** Validate the skill exists + is active (gives a typed 404 instead of a raw FK violation). */
  async assertSkillExists(tx: TxContext, skillId: string): Promise<void> {
    const r = await tx.query(`SELECT 1 FROM skills WHERE id=$1 AND is_active=true`, [skillId]);
    if (!r.rows[0]) throw new SkillNotFoundError(skillId);
  }
}
