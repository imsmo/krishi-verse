// modules/ambassadors/repositories/ambassador-visit.repository.ts · all SQL for ambassador_visits.
// tenant_id in EVERY query (Law 1) + RLS. Reads on the replica; the list is KEYSET (visited_at, id), never
// OFFSET, and is ALWAYS scoped to one ambassador_id (the caller's own profile → no IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AmbassadorVisit } from '../domain/ambassador-visit.entity';

const COLS = `id, tenant_id, ambassador_id, visited_user_id, purpose, notes, lat, lng, region_id, visited_at, created_at`;
function toDomain(r: any): AmbassadorVisit {
  return AmbassadorVisit.rehydrate({
    id: r.id, tenantId: r.tenant_id, ambassadorId: r.ambassador_id, visitedUserId: r.visited_user_id,
    purpose: r.purpose, notes: r.notes, lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
    regionId: r.region_id, visitedAt: r.visited_at, createdAt: r.created_at,
  });
}
export interface VisitListQuery { cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AmbassadorVisitRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, v: AmbassadorVisit): Promise<void> {
    const p = v.toProps();
    await tx.query(
      `INSERT INTO ambassador_visits (id, tenant_id, ambassador_id, visited_user_id, purpose, notes, lat, lng, region_id, visited_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.tenantId, p.ambassadorId, p.visitedUserId, p.purpose, p.notes, p.lat, p.lng, p.regionId, p.visitedAt, p.ambassadorId]);
  }

  /** The caller-ambassador's own visits, newest first, keyset. */
  async listForAmbassador(tenantId: string, ambassadorId: string, q: VisitListQuery): Promise<AmbassadorVisit[]> {
    const params: unknown[] = [tenantId, ambassadorId];
    let where = `tenant_id=$1 AND ambassador_id=$2 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (visited_at < ${cc} OR (visited_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ambassador_visits WHERE ${where} ORDER BY visited_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  /** Count of an ambassador's visits in a date window — feeds the leaderboard 'visits' metric. */
  async countInWindow(tenantId: string, ambassadorId: string, fromInclusive: string | null, toInclusive: string | null): Promise<number> {
    const params: unknown[] = [tenantId, ambassadorId];
    let where = `tenant_id=$1 AND ambassador_id=$2 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (fromInclusive) where += ` AND visited_at >= ${p(fromInclusive)}`;
    if (toInclusive) where += ` AND visited_at < (${p(toInclusive)}::date + interval '1 day')`;
    const r = await this.replica.forTenant(tenantId).query<{ n: number }>(`SELECT count(*)::int n FROM ambassador_visits WHERE ${where}`, params);
    return r.rows[0]?.n ?? 0;
  }
}
