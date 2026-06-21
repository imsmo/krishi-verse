// apps/admin-api/src/modules/tenant-ops/services/approve-tenant.service.ts · approve a pending/trial tenant into
// active. One ACID tx (Law 4): lock the row FOR UPDATE → entity.approve() (state machine + stamp approved_at) →
// updateStatus → tenant_status_events row → audit_log row — all commit atomically. Authorization (owner perm +
// hardware-key + step-up) is enforced at the controller; the service records the actor.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantNotFoundError } from '../domain/tenant-ops.errors';
import { ApproveTenantDto } from '../dto/tenant-ops.dto';

@Injectable()
export class ApproveTenantService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: TenantRepository) {}

  async approve(actor: AdminRequestContext, id: string, dto: ApproveTenantDto) {
    return this.pool.withTx(async (client) => {
      const tenant = await this.repo.getForUpdate(client, id);
      if (!tenant) throw new TenantNotFoundError(id);
      const change = tenant.approve();                          // throws on illegal source state / transition
      await this.repo.updateStatus(client, id, change.to, actor.userId, change.approvedAt);
      await this.repo.insertStatusEvent(client, id, change.from, change.to, dto.reason, actor.userId);
      await this.audit.write(client, {
        actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'tenant.approved',
        entityType: 'tenant', entityId: id, oldValue: { status: change.from }, newValue: { status: change.to },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null,
      });
      return tenant.toJSON();
    });
  }
}
