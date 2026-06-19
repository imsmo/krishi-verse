// modules/warehousing/repositories/assay-report.repository.ts · all SQL for assay_reports. tenant_id in
// EVERY query (Law 1) + RLS. Append-only quality records; reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AssayReport } from '../domain/assay-report.entity';

const COLS = `id, tenant_id, storage_booking_id, assayer_name, parameters, grade_option_id, report_media_id, assayed_at, valid_until, created_at`;
const d = (v: any): string | null => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): AssayReport {
  return AssayReport.rehydrate({ id: r.id, tenantId: r.tenant_id, storageBookingId: r.storage_booking_id, assayerName: r.assayer_name, parameters: r.parameters ?? {},
    gradeOptionId: r.grade_option_id, reportMediaId: r.report_media_id, assayedAt: r.assayed_at, validUntil: d(r.valid_until), createdAt: r.created_at });
}

@Injectable()
export class AssayReportRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, a: AssayReport): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `INSERT INTO assay_reports (id, tenant_id, storage_booking_id, assayer_name, parameters, grade_option_id, report_media_id, assayed_at, valid_until, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,(SELECT depositor_user_id FROM storage_bookings WHERE id=$3 AND tenant_id=$2))`,
      [p.id, p.tenantId, p.storageBookingId, p.assayerName, JSON.stringify(p.parameters), p.gradeOptionId, p.reportMediaId, p.assayedAt, p.validUntil]);
  }
  async listForBooking(tenantId: string, storageBookingId: string): Promise<AssayReport[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM assay_reports WHERE tenant_id=$1 AND storage_booking_id=$2 AND deleted_at IS NULL ORDER BY assayed_at DESC LIMIT 100`, [tenantId, storageBookingId]);
    return r.rows.map(toDomain);
  }
}
