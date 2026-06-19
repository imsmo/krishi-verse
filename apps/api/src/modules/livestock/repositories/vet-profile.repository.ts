// modules/livestock/repositories/vet-profile.repository.ts · all SQL for vet_profiles. tenant_id bound
// (Law 1) + RLS; one profile per user (user_id UNIQUE). No version column → mutations lock FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { VetProfile } from '../domain/vet-profile.entity';

const COLS = `id, user_id, tenant_id, registration_no, is_ai_technician, service_radius_km, base_region_id, rating_avg, created_at`;
function toDomain(r: any): VetProfile {
  return VetProfile.rehydrate({ id: r.id, userId: r.user_id, tenantId: r.tenant_id, registrationNo: r.registration_no,
    isAiTechnician: r.is_ai_technician, serviceRadiusKm: r.service_radius_km, baseRegionId: r.base_region_id,
    ratingAvg: r.rating_avg != null ? Number(r.rating_avg) : null, createdAt: r.created_at });
}
export interface VetListQuery { baseRegionId?: string; isAiTechnician?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class VetProfileRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, v: VetProfile): Promise<void> {
    const p = v.toProps();
    await tx.query(
      `INSERT INTO vet_profiles (id, user_id, tenant_id, registration_no, is_ai_technician, service_radius_km, base_region_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$2)`,
      [p.id, p.userId, p.tenantId, p.registrationNo, p.isAiTechnician, p.serviceRadiusKm, p.baseRegionId]);
  }
  async findByUser(tenantId: string, userId: string, tx?: TxContext): Promise<VetProfile | null> {
    const sql = `SELECT ${COLS} FROM vet_profiles WHERE tenant_id=$1 AND user_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [tenantId, userId]) : await this.replica.forTenant(tenantId).query(sql, [tenantId, userId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<VetProfile | null> {
    const sql = `SELECT ${COLS} FROM vet_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listFor(tenantId: string, q: VetListQuery): Promise<VetProfile[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.baseRegionId) where += ` AND base_region_id=${p(q.baseRegionId)}`;
    if (q.isAiTechnician !== undefined) where += ` AND is_ai_technician=${p(q.isAiTechnician)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM vet_profiles WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
