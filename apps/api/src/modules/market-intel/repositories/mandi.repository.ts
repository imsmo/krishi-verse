// modules/market-intel/repositories/mandi.repository.ts · mandis (GLOBAL reference — no tenant_id, no RLS).
// Read-only browse here (authoring is admin-api, Law 11). Keyset list; active markets only.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { Mandi } from '../domain/mandi.entity';

const COLS = `id, default_name, region_id, mandi_code, lat, lng, is_active, created_at`;
function toDomain(r: any): Mandi {
  return Mandi.rehydrate({ id: r.id, defaultName: r.default_name, regionId: r.region_id, mandiCode: r.mandi_code, lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null, isActive: r.is_active, createdAt: r.created_at });
}
export interface MandiListQuery { regionId?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class MandiRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async getById(tenantId: string, id: string): Promise<Mandi | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM mandis WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listFor(tenantId: string, q: MandiListQuery): Promise<Mandi[]> {
    const params: unknown[] = []; let where = `is_active=true AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.regionId) where += ` AND region_id=${p(q.regionId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM mandis WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
