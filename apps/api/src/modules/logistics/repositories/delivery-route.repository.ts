// modules/logistics/repositories/delivery-route.repository.ts · SQL for delivery_routes (0007). NOT partitioned.
// Tenant-scoped (tenant_id NOT NULL) + RLS. No version col → mutations lock the row. Reads on the replica; keyset
// on (created_at, id). village_region_ids is a jsonb array. vehicle_id / consolidation_user_id FK violations
// surface as a typed 422.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext, SqlExecutor } from '../../../core/database/unit-of-work';
import { DeliveryRoute } from '../domain/delivery-route.entity';
import { UnknownZoneRouteReferenceError } from '../domain/logistics.errors';

export interface DueRouteRow { id: string; tenantId: string; defaultName: string; vehicleId: string | null; consolidationUserId: string | null; }

const COLS = `id, tenant_id, default_name, run_weekday, village_region_ids, vehicle_id, consolidation_user_id, is_active, created_at`;
const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);

function toDomain(r: any): DeliveryRoute {
  return DeliveryRoute.rehydrate({
    id: r.id, tenantId: r.tenant_id, defaultName: r.default_name, runWeekday: r.run_weekday, villageRegionIds: arr(r.village_region_ids),
    vehicleId: r.vehicle_id, consolidationUserId: r.consolidation_user_id, isActive: r.is_active, createdAt: r.created_at,
  });
}
export interface RouteListQuery { runWeekday?: number; activeOnly: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class DeliveryRouteRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, e: DeliveryRoute): Promise<void> {
    const p = e.toProps();
    try {
      await tx.query(
        `INSERT INTO delivery_routes (id, tenant_id, default_name, run_weekday, village_region_ids, vehicle_id, consolidation_user_id, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8, now())`,
        [p.id, p.tenantId, p.defaultName, p.runWeekday, JSON.stringify(p.villageRegionIds), p.vehicleId, p.consolidationUserId, p.isActive]);
    } catch (e2: any) { if (e2?.code === '23503') throw new UnknownZoneRouteReferenceError('vehicle_or_consolidation_user'); throw e2; }
  }

  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<DeliveryRoute | null> {
    const r = await tx.query(`SELECT ${COLS} FROM delivery_routes WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<DeliveryRoute | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM delivery_routes WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }

  async update(tx: TxContext, e: DeliveryRoute): Promise<void> {
    const p = e.toProps();
    try {
      await tx.query(
        `UPDATE delivery_routes SET default_name=$3, run_weekday=$4, village_region_ids=$5::jsonb, vehicle_id=$6, consolidation_user_id=$7, is_active=$8, updated_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [p.id, p.tenantId, p.defaultName, p.runWeekday, JSON.stringify(p.villageRegionIds), p.vehicleId, p.consolidationUserId, p.isActive]);
    } catch (e2: any) { if (e2?.code === '23503') throw new UnknownZoneRouteReferenceError('vehicle_or_consolidation_user'); throw e2; }
  }

  /** Cross-tenant scan for the Village-Run consolidation job: active routes scheduled for `weekday`. Bounded. */
  async findActiveByWeekday(exec: SqlExecutor, weekday: number, limit: number): Promise<DueRouteRow[]> {
    const r = await exec.query(
      `SELECT id, tenant_id, default_name, vehicle_id, consolidation_user_id FROM delivery_routes
        WHERE is_active = true AND run_weekday = $1 AND deleted_at IS NULL ORDER BY id LIMIT $2`, [weekday, limit]);
    return r.rows.map((x: any) => ({ id: x.id, tenantId: x.tenant_id, defaultName: x.default_name, vehicleId: x.vehicle_id, consolidationUserId: x.consolidation_user_id }));
  }

  async list(tenantId: string, q: RouteListQuery): Promise<DeliveryRoute[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `tenant_id=$1`;
    if (q.runWeekday !== undefined) where += ` AND run_weekday=${p(q.runWeekday)}`;
    if (q.activeOnly) where += ` AND is_active = true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM delivery_routes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
