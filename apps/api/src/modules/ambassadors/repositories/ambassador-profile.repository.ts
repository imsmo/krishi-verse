// modules/ambassadors/repositories/ambassador-profile.repository.ts · ambassador_profiles. tenant_id in every
// query (Law 1) + RLS. No version → mutations lock FOR UPDATE. One profile per user (UNIQUE user_id). Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AmbassadorProfile } from '../domain/ambassador-profile.entity';

const COLS = `id, user_id, tenant_id, cluster_region_ids, tier_id, mentor_ambassador_id, training_completed_at, kiosk_enabled, aeps_enabled, monthly_stipend_minor, last_activity_at, is_active, created_at`;
function toDomain(r: any): AmbassadorProfile {
  return AmbassadorProfile.rehydrate({ id: r.id, userId: r.user_id, tenantId: r.tenant_id, clusterRegionIds: (r.cluster_region_ids ?? []) as string[], tierId: r.tier_id,
    mentorAmbassadorId: r.mentor_ambassador_id, trainingCompletedAt: r.training_completed_at, kioskEnabled: r.kiosk_enabled, aepsEnabled: r.aeps_enabled,
    monthlyStipendMinor: BigInt(r.monthly_stipend_minor), lastActivityAt: r.last_activity_at, isActive: r.is_active, createdAt: r.created_at });
}
export interface ProfileListQuery { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AmbassadorProfileRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, a: AmbassadorProfile): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `INSERT INTO ambassador_profiles (id, user_id, tenant_id, cluster_region_ids, tier_id, mentor_ambassador_id, training_completed_at, kiosk_enabled, aeps_enabled, monthly_stipend_minor, is_active, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$2)`,
      [p.id, p.userId, p.tenantId, JSON.stringify(p.clusterRegionIds), p.tierId, p.mentorAmbassadorId, p.trainingCompletedAt, p.kioskEnabled, p.aepsEnabled, p.monthlyStipendMinor.toString(), p.isActive]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<AmbassadorProfile | null> {
    const r = await tx.query(`SELECT ${COLS} FROM ambassador_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<AmbassadorProfile | null> {
    const sql = `SELECT ${COLS} FROM ambassador_profiles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async findByUser(tenantId: string, userId: string, tx?: TxContext): Promise<AmbassadorProfile | null> {
    const sql = `SELECT ${COLS} FROM ambassador_profiles WHERE user_id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [userId, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [userId, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, a: AmbassadorProfile): Promise<void> {
    const p = a.toProps();
    await tx.query(`UPDATE ambassador_profiles SET cluster_region_ids=$3::jsonb, tier_id=$4, mentor_ambassador_id=$5, training_completed_at=$6, kiosk_enabled=$7, aeps_enabled=$8, monthly_stipend_minor=$9, last_activity_at=$10, is_active=$11, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, JSON.stringify(p.clusterRegionIds), p.tierId, p.mentorAmbassadorId, p.trainingCompletedAt, p.kioskEnabled, p.aepsEnabled, p.monthlyStipendMinor.toString(), p.lastActivityAt, p.isActive]);
  }
  async listFor(tenantId: string, q: ProfileListQuery): Promise<AmbassadorProfile[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.activeOnly) where += ` AND is_active=true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ambassador_profiles WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
