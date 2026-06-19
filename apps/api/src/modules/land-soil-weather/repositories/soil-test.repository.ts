// modules/land-soil-weather/repositories/soil-test.repository.ts · all SQL for soil_tests. tenant_id in
// EVERY query (Law 1) + RLS. Append-only quality records; reads on replica.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { SoilTest } from '../domain/soil-test.entity';

const COLS = `id, tenant_id, parcel_id, lab_name, shc_card_no, sampled_on, results, recommendations, report_media_id, valid_until, created_at`;
const d = (v: any): string | null => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): SoilTest {
  return SoilTest.rehydrate({ id: r.id, tenantId: r.tenant_id, parcelId: r.parcel_id, labName: r.lab_name, shcCardNo: r.shc_card_no, sampledOn: d(r.sampled_on)!, results: r.results ?? {}, recommendations: r.recommendations ?? {}, reportMediaId: r.report_media_id, validUntil: d(r.valid_until), createdAt: r.created_at });
}
@Injectable()
export class SoilTestRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, t: SoilTest): Promise<void> {
    const p = t.toProps();
    await tx.query(`INSERT INTO soil_tests (id, tenant_id, parcel_id, lab_name, shc_card_no, sampled_on, results, recommendations, report_media_id, valid_until, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,NULL)`,
      [p.id, p.tenantId, p.parcelId, p.labName, p.shcCardNo, p.sampledOn, JSON.stringify(p.results), JSON.stringify(p.recommendations), p.reportMediaId, p.validUntil]);
  }
  async listForParcel(tenantId: string, parcelId: string): Promise<SoilTest[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM soil_tests WHERE tenant_id=$1 AND parcel_id=$2 AND deleted_at IS NULL ORDER BY sampled_on DESC, id DESC LIMIT 200`, [tenantId, parcelId]);
    return r.rows.map(toDomain);
  }
}
