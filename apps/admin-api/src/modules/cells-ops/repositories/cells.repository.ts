// apps/admin-api/src/modules/cells-ops/repositories/cells.repository.ts · ALL SQL for cells-ops. Reads + in-tx
// writes for the routing directory: cells, shards (dsn_secret_ref NEVER selected/returned — only `has_dsn`),
// tenant_placements (keyed by placed_tenant_id), the residency report, and cell_map_changes. Parameterised only;
// keyset paging (never OFFSET); writes take the caller's tx client; concurrency via SELECT … FOR UPDATE.
// placed_count on cells/shards is maintained atomically in the SAME tx as each placement change (capacity guard).
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { Cell, CellProps } from '../domain/cell.entity';
import { Shard, ShardProps } from '../domain/shard.entity';

const CELL_COLS = `id, code, display_name, country_code, status, is_default, residency_locked, capacity_tenants, placed_count, notes, created_at`;
function toCell(r: any): Cell {
  const p: CellProps = { id: r.id, code: r.code, displayName: r.display_name, countryCode: r.country_code, status: r.status, isDefault: r.is_default, residencyLocked: r.residency_locked, capacityTenants: r.capacity_tenants ?? null, placedCount: r.placed_count, notes: r.notes ?? null, createdAt: r.created_at ?? null };
  return Cell.rehydrate(p);
}
// NOTE: dsn_secret_ref IS selected here (the entity needs it to no-op-diff on update) but NEVER leaves the entity (toJSON omits it).
const SHARD_COLS = `id, cell_id, shard_index, status, weight, placed_count, dsn_secret_ref, notes, created_at`;
function toShard(r: any): Shard {
  const p: ShardProps = { id: r.id, cellId: r.cell_id, shardIndex: r.shard_index, status: r.status, weight: r.weight, placedCount: r.placed_count, dsnSecretRef: r.dsn_secret_ref ?? null, notes: r.notes ?? null, createdAt: r.created_at ?? null };
  return Shard.rehydrate(p);
}

export interface CellListQuery { countryCode?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }
export interface ShardListQuery { cellId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }
export interface PlacementListQuery { cellId?: string; shardId?: string; cursor?: { c: string; id: string }; limit: number; }
export interface ChangeListQuery { entityType: 'cell' | 'shard' | 'placement'; entityId: string; cursor?: { c: string; id: string }; limit: number; }
export interface PlacementRow { tenantId: string; cellId: string; shardId: string; pinned: boolean; createdAt: Date | null; }

@Injectable()
export class CellsRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ============================ cells ============================ */
  async listCells(q: CellListQuery): Promise<Cell[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.countryCode) where += ` AND country_code=${p(q.countryCode)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${CELL_COLS} FROM cells WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toCell);
  }
  async getCell(id: string): Promise<Cell | null> {
    const r = await this.pool.query(`SELECT ${CELL_COLS} FROM cells WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toCell(r.rows[0]) : null;
  }
  async getCellForUpdate(client: PoolClient, id: string): Promise<Cell | null> {
    const r = await client.query(`SELECT ${CELL_COLS} FROM cells WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toCell(r.rows[0]) : null;
  }
  async cellCodeExists(client: PoolClient, code: string): Promise<boolean> {
    const r = await client.query(`SELECT 1 FROM cells WHERE code=$1 LIMIT 1`, [code]);   // code is UNIQUE (incl. soft-deleted)
    return (r.rowCount ?? 0) > 0;
  }
  async insertCell(client: PoolClient, v: { code: string; displayName: string; countryCode: string; isDefault: boolean; residencyLocked: boolean; capacityTenants: number | null; notes: string | null; actorUserId: string }): Promise<{ id: string; createdAt: Date }> {
    const r = await client.query(
      `INSERT INTO cells (code, display_name, country_code, status, is_default, residency_locked, capacity_tenants, placed_count, notes, created_by, updated_by)
       VALUES ($1,$2,$3,'active',$4,$5,$6,0,$7,$8,$8) RETURNING id, created_at`,
      [v.code, v.displayName, v.countryCode, v.isDefault, v.residencyLocked, v.capacityTenants, v.notes, v.actorUserId]);
    return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
  }
  /** Clear the current default cell for a country (so a new default can be set) — within the caller's tx. */
  async clearDefaultForCountry(client: PoolClient, countryCode: string, exceptId: string, actorUserId: string): Promise<void> {
    await client.query(`UPDATE cells SET is_default=false, updated_by=$3, updated_at=now() WHERE country_code=$1 AND is_default AND id<>$2 AND deleted_at IS NULL`, [countryCode, exceptId, actorUserId]);
  }
  async updateCell(client: PoolClient, id: string, v: { displayName: string; status: string; isDefault: boolean; residencyLocked: boolean; capacityTenants: number | null; notes: string | null; actorUserId: string }): Promise<void> {
    await client.query(
      `UPDATE cells SET display_name=$2, status=$3, is_default=$4, residency_locked=$5, capacity_tenants=$6, notes=$7, updated_by=$8, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
      [id, v.displayName, v.status, v.isDefault, v.residencyLocked, v.capacityTenants, v.notes, v.actorUserId]);
  }
  async bumpCellPlaced(client: PoolClient, id: string, delta: number, actorUserId: string): Promise<void> {
    await client.query(`UPDATE cells SET placed_count = placed_count + $2, updated_by=$3, updated_at=now() WHERE id=$1`, [id, delta, actorUserId]);
  }

  /* ============================ shards ============================ */
  async listShards(q: ShardListQuery): Promise<Shard[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.cellId) where += ` AND cell_id=${p(q.cellId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${SHARD_COLS} FROM shards WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toShard);
  }
  async getShard(id: string): Promise<Shard | null> {
    const r = await this.pool.query(`SELECT ${SHARD_COLS} FROM shards WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toShard(r.rows[0]) : null;
  }
  async getShardForUpdate(client: PoolClient, id: string): Promise<Shard | null> {
    const r = await client.query(`SELECT ${SHARD_COLS} FROM shards WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toShard(r.rows[0]) : null;
  }
  async shardIndexExists(client: PoolClient, cellId: string, shardIndex: number): Promise<boolean> {
    const r = await client.query(`SELECT 1 FROM shards WHERE cell_id=$1 AND shard_index=$2 LIMIT 1`, [cellId, shardIndex]);
    return (r.rowCount ?? 0) > 0;
  }
  async insertShard(client: PoolClient, v: { cellId: string; shardIndex: number; weight: number; dsnSecretRef: string | null; notes: string | null; actorUserId: string }): Promise<{ id: string; createdAt: Date }> {
    const r = await client.query(
      `INSERT INTO shards (cell_id, shard_index, status, weight, placed_count, dsn_secret_ref, notes, created_by, updated_by)
       VALUES ($1,$2,'active',$3,0,$4,$5,$6,$6) RETURNING id, created_at`,
      [v.cellId, v.shardIndex, v.weight, v.dsnSecretRef, v.notes, v.actorUserId]);
    return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
  }
  async updateShard(client: PoolClient, id: string, v: { status: string; weight: number; dsnSecretRef: string | null; notes: string | null; actorUserId: string }): Promise<void> {
    await client.query(`UPDATE shards SET status=$2, weight=$3, dsn_secret_ref=$4, notes=$5, updated_by=$6, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
      [id, v.status, v.weight, v.dsnSecretRef, v.notes, v.actorUserId]);
  }
  async bumpShardPlaced(client: PoolClient, id: string, delta: number, actorUserId: string): Promise<void> {
    await client.query(`UPDATE shards SET placed_count = placed_count + $2, updated_by=$3, updated_at=now() WHERE id=$1`, [id, delta, actorUserId]);
  }

  /* ============================ tenant_placements (directory) ============================ */
  private static toPlacement(r: any): PlacementRow { return { tenantId: r.placed_tenant_id, cellId: r.cell_id, shardId: r.shard_id, pinned: r.pinned, createdAt: r.created_at ?? null }; }
  async getPlacement(tenantId: string): Promise<PlacementRow | null> {
    const r = await this.pool.query(`SELECT placed_tenant_id, cell_id, shard_id, pinned, created_at FROM tenant_placements WHERE placed_tenant_id=$1 AND deleted_at IS NULL`, [tenantId]);
    return r.rows[0] ? CellsRepository.toPlacement(r.rows[0]) : null;
  }
  async getPlacementForUpdate(client: PoolClient, tenantId: string): Promise<PlacementRow | null> {
    const r = await client.query(`SELECT placed_tenant_id, cell_id, shard_id, pinned, created_at FROM tenant_placements WHERE placed_tenant_id=$1 AND deleted_at IS NULL FOR UPDATE`, [tenantId]);
    return r.rows[0] ? CellsRepository.toPlacement(r.rows[0]) : null;
  }
  async insertPlacement(client: PoolClient, v: { tenantId: string; cellId: string; shardId: string; pinned: boolean; actorUserId: string }): Promise<void> {
    // a previously-removed (soft-deleted) placement is revived in place so the PK holds
    await client.query(
      `INSERT INTO tenant_placements (placed_tenant_id, cell_id, shard_id, pinned, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT (placed_tenant_id) DO UPDATE SET cell_id=EXCLUDED.cell_id, shard_id=EXCLUDED.shard_id, pinned=EXCLUDED.pinned, deleted_at=NULL, updated_by=EXCLUDED.updated_by, updated_at=now()`,
      [v.tenantId, v.cellId, v.shardId, v.pinned, v.actorUserId]);
  }
  async updatePlacement(client: PoolClient, tenantId: string, v: { cellId: string; shardId: string; pinned: boolean; actorUserId: string }): Promise<void> {
    await client.query(`UPDATE tenant_placements SET cell_id=$2, shard_id=$3, pinned=$4, updated_by=$5, updated_at=now() WHERE placed_tenant_id=$1 AND deleted_at IS NULL`,
      [tenantId, v.cellId, v.shardId, v.pinned, v.actorUserId]);
  }
  async softDeletePlacement(client: PoolClient, tenantId: string, actorUserId: string): Promise<void> {
    await client.query(`UPDATE tenant_placements SET deleted_at=now(), updated_by=$2, updated_at=now() WHERE placed_tenant_id=$1 AND deleted_at IS NULL`, [tenantId, actorUserId]);
  }
  async listPlacements(q: PlacementListQuery): Promise<PlacementRow[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.cellId) where += ` AND cell_id=${p(q.cellId)}`;
    if (q.shardId) where += ` AND shard_id=${p(q.shardId)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND placed_tenant_id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT placed_tenant_id, cell_id, shard_id, pinned, created_at FROM tenant_placements WHERE ${where} ORDER BY created_at DESC, placed_tenant_id DESC LIMIT ${lp}`, params);
    return r.rows.map(CellsRepository.toPlacement);
  }

  /* ============================ residency report ============================ */
  async residencyReport(): Promise<any[]> {
    const r = await this.pool.query(
      `SELECT country_code,
              count(*)::int AS cells,
              count(*) FILTER (WHERE status='active')::int AS active_cells,
              bool_and(residency_locked) AS all_locked,
              COALESCE(sum(placed_count),0)::int AS placed_tenants
         FROM cells WHERE deleted_at IS NULL GROUP BY country_code ORDER BY country_code`);
    return r.rows.map((x: any) => ({ countryCode: x.country_code, cells: x.cells, activeCells: x.active_cells, allResidencyLocked: x.all_locked, placedTenants: x.placed_tenants }));
  }

  /* ============================ cell_map_changes (append-only) ============================ */
  async insertChange(client: PoolClient, c: { entityType: 'cell' | 'shard' | 'placement'; entityId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO cell_map_changes (entity_type, entity_id, action, old_value, new_value, reason, actor_user_id) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
      [c.entityType, c.entityId, c.action, c.oldValue != null ? JSON.stringify(c.oldValue) : null, c.newValue != null ? JSON.stringify(c.newValue) : null, c.reason, c.actorUserId]);
  }
  async listChanges(q: ChangeListQuery): Promise<any[]> {
    const params: unknown[] = [q.entityType, q.entityId]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'entity_type=$1 AND entity_id=$2';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, entity_type, entity_id, action, old_value, new_value, reason, actor_user_id, created_at FROM cell_map_changes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, entityType: x.entity_type, entityId: x.entity_id, action: x.action, oldValue: x.old_value ?? null, newValue: x.new_value ?? null, reason: x.reason, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }
}
