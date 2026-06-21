// apps/admin-api/src/modules/cells-ops/services/cell-registry.service.ts · the topology registry: cells + shards
// (list/get/create/update-meta/status-lifecycle/history). One ACID tx per write; every write commits a
// cell_map_changes row + an append-only audit_log row IN THE SAME TX (§4). Status moves only through the node
// state machine (Law 5); a node may be RETIRED only once empty (placed_count=0, guarded). A new default cell
// atomically clears the previous default for that country. dsn_secret_ref is never returned (Shard.toJSON omits it).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { CellsRepository, CellListQuery, ShardListQuery, ChangeListQuery } from '../repositories/cells.repository';
import { CellNotFoundError, ShardNotFoundError, DuplicateCellCodeError, DuplicateShardIndexError, NodeNotEmptyError } from '../domain/cells-ops.errors';
import { assertCellCode, assertName, assertCountry, assertCapacity, assertNotes, assertShardIndex, assertWeight } from '../domain/routing';
import { NodeStatus } from '../domain/node.state';
import { CreateCellDto, UpdateCellDto, SetStatusDto, SetDefaultDto, CreateShardDto, UpdateShardDto } from '../dto/cells-ops.dto';

const tsCursor = (createdAt: any, id: string) => Buffer.from(`${createdAt?.toISOString?.() ?? createdAt}|${id}`).toString('base64');

@Injectable()
export class CellRegistryService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: CellsRepository) {}

  private audited(actor: AdminRequestContext, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown, reason: string) {
    return { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action, entityType, entityId, oldValue, newValue, reason, ip: actor.ip, requestId: actor.requestId || null };
  }

  /* ---------------- cells ---------------- */
  async listCells(q: CellListQuery) {
    const items = (await this.repo.listCells(q)).map((c) => c.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
  async getCell(id: string) {
    const c = await this.repo.getCell(id);
    if (!c) throw new CellNotFoundError(id);
    return c.toJSON();
  }
  async createCell(actor: AdminRequestContext, dto: CreateCellDto) {
    const code = assertCellCode(dto.code);
    const displayName = assertName(dto.displayName);
    const countryCode = assertCountry(dto.countryCode);
    const capacityTenants = assertCapacity(dto.capacityTenants ?? null);
    const notes = assertNotes(dto.notes ?? null);
    return this.pool.withTx(async (client) => {
      if (await this.repo.cellCodeExists(client, code)) throw new DuplicateCellCodeError(code);
      const ins = await this.repo.insertCell(client, { code, displayName, countryCode, isDefault: dto.isDefault, residencyLocked: dto.residencyLocked, capacityTenants, notes, actorUserId: actor.userId });
      if (dto.isDefault) await this.repo.clearDefaultForCountry(client, countryCode, ins.id, actor.userId);   // one default per country
      const newValue = { id: ins.id, code, countryCode, status: 'active', isDefault: dto.isDefault, residencyLocked: dto.residencyLocked, capacityTenants };
      await this.repo.insertChange(client, { entityType: 'cell', entityId: ins.id, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.cell.created', 'cell', ins.id, null, newValue, dto.reason));
      return { ...newValue, createdAt: ins.createdAt };
    });
  }
  async updateCell(actor: AdminRequestContext, id: string, dto: UpdateCellDto) {
    return this.pool.withTx(async (client) => {
      const cell = await this.repo.getCellForUpdate(client, id);
      if (!cell) throw new CellNotFoundError(id);
      const change = cell.updateMeta({ displayName: dto.displayName, capacityTenants: dto.capacityTenants, residencyLocked: dto.residencyLocked, notes: dto.notes });   // throws on no-op
      const pr = cell.persist;
      await this.repo.updateCell(client, id, { displayName: pr.displayName, status: pr.status as string, isDefault: pr.isDefault, residencyLocked: pr.residencyLocked, capacityTenants: pr.capacityTenants, notes: pr.notes, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'cell', entityId: id, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.cell.updated', 'cell', id, change.old, change.new, dto.reason));
      return cell.toJSON();
    });
  }
  async setCellStatus(actor: AdminRequestContext, id: string, dto: SetStatusDto) {
    return this.pool.withTx(async (client) => {
      const cell = await this.repo.getCellForUpdate(client, id);
      if (!cell) throw new CellNotFoundError(id);
      if (dto.status === 'retired' && cell.placedCount > 0) throw new NodeNotEmptyError('cell', cell.placedCount);
      const change = cell.changeStatus(dto.status as NodeStatus);   // throws on illegal / no-op
      const pr = cell.persist;
      await this.repo.updateCell(client, id, { displayName: pr.displayName, status: pr.status as string, isDefault: pr.isDefault, residencyLocked: pr.residencyLocked, capacityTenants: pr.capacityTenants, notes: pr.notes, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'cell', entityId: id, action: 'status_changed', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.cell.status_changed', 'cell', id, change.old, change.new, dto.reason));
      return cell.toJSON();
    });
  }
  async setCellDefault(actor: AdminRequestContext, id: string, dto: SetDefaultDto) {
    return this.pool.withTx(async (client) => {
      const cell = await this.repo.getCellForUpdate(client, id);
      if (!cell) throw new CellNotFoundError(id);
      const change = cell.setDefault(dto.isDefault);   // throws on no-op
      if (dto.isDefault) await this.repo.clearDefaultForCountry(client, cell.countryCode, id, actor.userId);
      const pr = cell.persist;
      await this.repo.updateCell(client, id, { displayName: pr.displayName, status: pr.status as string, isDefault: pr.isDefault, residencyLocked: pr.residencyLocked, capacityTenants: pr.capacityTenants, notes: pr.notes, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'cell', entityId: id, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.cell.default_changed', 'cell', id, change.old, change.new, dto.reason));
      return cell.toJSON();
    });
  }
  async cellHistory(q: Omit<ChangeListQuery, 'entityType'>) {
    if (!(await this.repo.getCell(q.entityId))) throw new CellNotFoundError(q.entityId);
    const items = await this.repo.listChanges({ ...q, entityType: 'cell' });
    const last = items[items.length - 1] as any;
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }

  /* ---------------- shards ---------------- */
  async listShards(q: ShardListQuery) {
    const items = (await this.repo.listShards(q)).map((s) => s.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
  async getShard(id: string) {
    const s = await this.repo.getShard(id);
    if (!s) throw new ShardNotFoundError(id);
    return s.toJSON();
  }
  async createShard(actor: AdminRequestContext, dto: CreateShardDto) {
    const shardIndex = assertShardIndex(dto.shardIndex);
    const weight = assertWeight(dto.weight);
    const notes = assertNotes(dto.notes ?? null);
    const dsnSecretRef = dto.dsnSecretRef ?? null;
    return this.pool.withTx(async (client) => {
      const cell = await this.repo.getCellForUpdate(client, dto.cellId);
      if (!cell) throw new CellNotFoundError(dto.cellId);
      if (await this.repo.shardIndexExists(client, dto.cellId, shardIndex)) throw new DuplicateShardIndexError(dto.cellId, shardIndex);
      const ins = await this.repo.insertShard(client, { cellId: dto.cellId, shardIndex, weight, dsnSecretRef, notes, actorUserId: actor.userId });
      const newValue = { id: ins.id, cellId: dto.cellId, shardIndex, status: 'active', weight, hasDsn: dsnSecretRef !== null };
      await this.repo.insertChange(client, { entityType: 'shard', entityId: ins.id, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.shard.created', 'shard', ins.id, null, newValue, dto.reason));
      return { ...newValue, createdAt: ins.createdAt };
    });
  }
  async updateShard(actor: AdminRequestContext, id: string, dto: UpdateShardDto) {
    return this.pool.withTx(async (client) => {
      const shard = await this.repo.getShardForUpdate(client, id);
      if (!shard) throw new ShardNotFoundError(id);
      const change = shard.updateMeta({ weight: dto.weight, notes: dto.notes, dsnSecretRef: dto.dsnSecretRef });   // dsn masked in the change record; throws on no-op
      const pr = shard.persist;
      await this.repo.updateShard(client, id, { status: pr.status as string, weight: pr.weight, dsnSecretRef: pr.dsnSecretRef, notes: pr.notes, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'shard', entityId: id, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.shard.updated', 'shard', id, change.old, change.new, dto.reason));
      return shard.toJSON();
    });
  }
  async setShardStatus(actor: AdminRequestContext, id: string, dto: SetStatusDto) {
    return this.pool.withTx(async (client) => {
      const shard = await this.repo.getShardForUpdate(client, id);
      if (!shard) throw new ShardNotFoundError(id);
      if (dto.status === 'retired' && shard.placedCount > 0) throw new NodeNotEmptyError('shard', shard.placedCount);
      const change = shard.changeStatus(dto.status as NodeStatus);
      const pr = shard.persist;
      await this.repo.updateShard(client, id, { status: pr.status as string, weight: pr.weight, dsnSecretRef: pr.dsnSecretRef, notes: pr.notes, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'shard', entityId: id, action: 'status_changed', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.audited(actor, 'cells.shard.status_changed', 'shard', id, change.old, change.new, dto.reason));
      return shard.toJSON();
    });
  }
  async shardHistory(q: Omit<ChangeListQuery, 'entityType'>) {
    if (!(await this.repo.getShard(q.entityId))) throw new ShardNotFoundError(q.entityId);
    const items = await this.repo.listChanges({ ...q, entityType: 'shard' });
    const last = items[items.length - 1] as any;
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
}
