// apps/admin-api/src/modules/cells-ops/services/data-residency-rules.service.ts · the data-residency posture: a
// read-only per-country report (cells / active cells / placed tenants / whether all cells are residency-locked)
// and the deliberate, audited toggle of a cell's residency lock. A locked cell's tenants may never be moved across
// a residency border (enforced in the assignment service); UNLOCKING is a consequential, audited action. One ACID
// tx for the toggle: lock FOR UPDATE → entity diff (no-op throws) → UPDATE → cell_map_changes + audit_log, atomic.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { CellsRepository } from '../repositories/cells.repository';
import { CellNotFoundError } from '../domain/cells-ops.errors';
import { SetResidencyLockDto } from '../dto/cells-ops.dto';

@Injectable()
export class DataResidencyRulesService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: CellsRepository) {}

  /** Per-country residency posture over the cell map (no secrets, counts only). */
  async report() {
    return { items: await this.repo.residencyReport() };
  }

  async setResidencyLock(actor: AdminRequestContext, cellId: string, dto: SetResidencyLockDto) {
    return this.pool.withTx(async (client) => {
      const cell = await this.repo.getCellForUpdate(client, cellId);
      if (!cell) throw new CellNotFoundError(cellId);
      const change = cell.updateMeta({ residencyLocked: dto.residencyLocked });   // throws CellsAlreadyInState on no-op
      const pr = cell.persist;
      await this.repo.updateCell(client, cellId, { displayName: pr.displayName, status: pr.status as string, isDefault: pr.isDefault, residencyLocked: pr.residencyLocked, capacityTenants: pr.capacityTenants, notes: pr.notes, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'cell', entityId: cellId, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'cells.residency.lock_changed', entityType: 'cell', entityId: cellId, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return cell.toJSON();
    });
  }
}
