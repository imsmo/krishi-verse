// apps/admin-api/src/modules/tenant-ops/services/archive-tenant.service.ts · archive a tenant (offboarding).
// One ACID tx: lock → state machine (any non-terminal → archived) → updateStatus → tenant_status_events →
// audit. Archive is a heavy, near-terminal action (only archived→terminated remains); reason mandatory. Data
// retention / hard-delete is a separate compliance-ops + retention-job concern (NOT done here).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantNotFoundError } from '../domain/tenant-ops.errors';
import { ArchiveTenantDto } from '../dto/tenant-ops.dto';

@Injectable()
export class ArchiveTenantService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: TenantRepository) {}

  async archive(actor: AdminRequestContext, id: string, dto: ArchiveTenantDto) {
    return this.pool.withTx(async (client) => {
      const tenant = await this.repo.getForUpdate(client, id);
      if (!tenant) throw new TenantNotFoundError(id);
      const change = tenant.archive();                          // throws if already terminal
      await this.repo.updateStatus(client, id, change.to, actor.userId, null);
      await this.repo.insertStatusEvent(client, id, change.from, change.to, dto.reason, actor.userId);
      await this.audit.write(client, {
        actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'tenant.archived',
        entityType: 'tenant', entityId: id, oldValue: { status: change.from }, newValue: { status: change.to },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null,
      });
      return tenant.toJSON();
    });
  }
}
