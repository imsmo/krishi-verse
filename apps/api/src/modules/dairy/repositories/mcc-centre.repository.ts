// modules/dairy/repositories/mcc-centre.repository.ts · all SQL for mcc_centres. tenant_id in EVERY query
// (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Reads on replica; keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { MccCentre } from '../domain/mcc-centre.entity';

const COLS = `id, tenant_id, code, default_name, region_id, lat, lng, operator_user_id, capacity_litres_shift, analyzer_model, analyzer_serial, is_active, created_at`;
function toDomain(r: any): MccCentre {
  return MccCentre.rehydrate({ id: r.id, tenantId: r.tenant_id, code: r.code, defaultName: r.default_name, regionId: r.region_id,
    lat: r.lat != null ? String(r.lat) : null, lng: r.lng != null ? String(r.lng) : null, operatorUserId: r.operator_user_id,
    capacityLitresShift: r.capacity_litres_shift != null ? String(r.capacity_litres_shift) : null, analyzerModel: r.analyzer_model,
    analyzerSerial: r.analyzer_serial, isActive: r.is_active, createdAt: r.created_at });
}

@Injectable()
export class MccCentreRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, m: MccCentre): Promise<void> {
    const p = m.toProps();
    await tx.query(
      `INSERT INTO mcc_centres (id, tenant_id, code, default_name, region_id, lat, lng, operator_user_id, capacity_litres_shift, analyzer_model, analyzer_serial, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [p.id, p.tenantId, p.code, p.defaultName, p.regionId, p.lat, p.lng, p.operatorUserId, p.capacityLitresShift, p.analyzerModel, p.analyzerSerial, p.isActive, p.operatorUserId]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<MccCentre | null> {
    const r = await tx.query(`SELECT ${COLS} FROM mcc_centres WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<MccCentre | null> {
    const sql = `SELECT ${COLS} FROM mcc_centres WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, m: MccCentre): Promise<void> {
    const p = m.toProps();
    await tx.query(`UPDATE mcc_centres SET is_active=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.isActive]);
  }
  async listFor(tenantId: string, q: { activeOnly: boolean; cursor?: { c: string; id: string }; limit: number }): Promise<MccCentre[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.activeOnly) where += ` AND is_active=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM mcc_centres WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
