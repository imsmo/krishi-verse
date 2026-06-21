// apps/admin-api/src/modules/tenant-ops/services/suspend-tenant.service.ts · suspend a live tenant
// (active/trial/grace → suspended) — billing failure, abuse, or compliance hold. One ACID tx: lock → state
// machine → updateStatus → tenant_status_events → audit. Reason is mandatory (§4). Suspension is reversible
// (suspended→active) via approve/reactivate, so it's distinct from archive.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantNotFoundError } from '../domain/tenant-ops.errors';
import { SuspendTenantDto } from '../dto/tenant-ops.dto';

@Injectable()
export class SuspendTenantService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: TenantRepository) {}

  async suspend(actor: AdminRequestContext, id: string, dto: SuspendTenantDto) {
    return this.pool.withTx(async (client) => {
      const tenant = await this.repo.getForUpdate(client, id);
      if (!tenant) throw new TenantNotFoundError(id);
      const change = tenant.suspend();                          // throws IllegalTenantTransitionError if not live
      await this.repo.updateStatus(client, id, change.to, actor.userId, null);
      await this.repo.insertStatusEvent(client, id, change.from, change.to, dto.reason, actor.userId);
      await this.audit.write(client, {
        actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'tenant.suspended',
        entityType: 'tenant', entityId: id, oldValue: { status: change.from }, newValue: { status: change.to },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null,
      });
      return tenant.toJSON();
    });
  }
}
