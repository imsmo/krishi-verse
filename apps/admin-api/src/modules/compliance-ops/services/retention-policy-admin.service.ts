// apps/admin-api/src/modules/compliance-ops/services/retention-policy-admin.service.ts · god-mode retention
// config. Upsert a data_retention_policies row (per table: active months in hot partitions, archive months,
// legal basis, action archive|anonymise|delete|keep_forever). One ACID tx + audit-in-tx (old→new + reason).
// Validated by the pure guard (bounds + action enum). The retention WORKER (apps/worker) enforces these
// policies; this module owns the POLICY write. A wrong policy could over-retain or prematurely delete PII, so
// every change is audited with a mandatory reason (§4 / DPDP minimisation).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ComplianceRepository } from '../repositories/compliance.repository';
import { assertRetentionPolicy } from '../domain/breach.entity';
import { UpsertRetentionDto } from '../dto/compliance-ops.dto';

@Injectable()
export class RetentionPolicyAdminService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ComplianceRepository) {}

  async upsert(actor: AdminRequestContext, dto: UpsertRetentionDto) {
    assertRetentionPolicy(dto.activeMonths, dto.archiveMonths, dto.action);   // throws InvalidRetentionPolicyError
    return this.pool.withTx(async (client) => {
      const { previous } = await this.repo.upsertRetention(client, {
        tableName: dto.tableName, activeMonths: dto.activeMonths, archiveMonths: dto.archiveMonths,
        legalBasis: dto.legalBasis ?? null, action: dto.action, isActive: dto.isActive,
      }, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'dpdp.retention_policy_set', entityType: 'data_retention_policy', entityId: null,
        oldValue: previous, newValue: { tableName: dto.tableName, activeMonths: dto.activeMonths, archiveMonths: dto.archiveMonths, action: dto.action, isActive: dto.isActive },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { tableName: dto.tableName, activeMonths: dto.activeMonths, archiveMonths: dto.archiveMonths, legalBasis: dto.legalBasis ?? null, action: dto.action, isActive: dto.isActive };
    });
  }

  async list(limit = 100) {
    return { items: await this.repo.listRetention(limit) };
  }
}
