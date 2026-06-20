// modules/services-marketplace/repositories/service-booking.repository.ts · all SQL for service_bookings.
// tenant_id in EVERY query (Law 1) + RLS. The provider is not a column here — it is JOINed from
// service_offerings (so authz/settlement know the payee). No version → mutations lock FOR UPDATE OF b. Keyset.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ServiceBooking } from '../domain/service-booking.entity';
import { BookingStatus } from '../domain/service-booking.state';

const SEL = `b.id, b.tenant_id, b.offering_id, o.provider_user_id, b.customer_user_id, b.booking_no, b.starts_at, b.ends_at, b.guests, b.total_minor, b.status, b.notes, b.created_at
  FROM service_bookings b JOIN service_offerings o ON o.id = b.offering_id`;
function toDomain(r: any): ServiceBooking {
  return ServiceBooking.rehydrate({ id: r.id, tenantId: r.tenant_id, offeringId: r.offering_id, providerUserId: r.provider_user_id, customerUserId: r.customer_user_id, bookingNo: r.booking_no,
    startsAt: r.starts_at, endsAt: r.ends_at, guests: r.guests, totalMinor: BigInt(r.total_minor), status: r.status as BookingStatus, notes: r.notes, createdAt: r.created_at });
}
export interface BookingListQuery { customerUserId?: string; providerUserId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ServiceBookingRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, b: ServiceBooking): Promise<void> {
    const p = b.toProps();
    await tx.query(`INSERT INTO service_bookings (id, tenant_id, offering_id, customer_user_id, booking_no, starts_at, ends_at, guests, total_minor, status, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$4)`,
      [p.id, p.tenantId, p.offeringId, p.customerUserId, p.bookingNo, p.startsAt, p.endsAt, p.guests, p.totalMinor.toString(), p.status, p.notes]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ServiceBooking | null> {
    const r = await tx.query(`SELECT ${SEL} WHERE b.id=$1 AND b.tenant_id=$2 AND b.deleted_at IS NULL FOR UPDATE OF b`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<ServiceBooking | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${SEL} WHERE b.id=$1 AND b.tenant_id=$2 AND b.deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, b: ServiceBooking): Promise<void> {
    const p = b.toProps();
    await tx.query(`UPDATE service_bookings SET status=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.status]);
  }
  async listFor(tenantId: string, q: BookingListQuery): Promise<ServiceBooking[]> {
    const params: unknown[] = [tenantId]; let where = `b.tenant_id=$1 AND b.deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.customerUserId) where += ` AND b.customer_user_id=${p(q.customerUserId)}`;
    if (q.providerUserId) where += ` AND o.provider_user_id=${p(q.providerUserId)}`;
    if (q.status) where += ` AND b.status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (b.created_at < ${cc} OR (b.created_at=${cc} AND b.id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${SEL} WHERE ${where} ORDER BY b.created_at DESC, b.id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
