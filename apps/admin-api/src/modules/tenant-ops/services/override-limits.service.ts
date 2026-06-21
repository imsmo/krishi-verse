// apps/admin-api/src/modules/tenant-ops/services/override-limits.service.ts · set a per-tenant numeric quota
// override (tenant_limit_overrides) beyond the plan — anchor deals, pilots, abuse clamps. One ACID tx: verify
// the tenant exists → upsert the override → audit (old→new value + reason) in the same tx. limit_value is
// bigint (-1=unlimited) handled as a string param (never floated). The QuotaService read-merge lives in apps/api.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantNotFoundError } from '../domain/tenant-ops.errors';
import { OverrideLimitDto } from '../dto/tenant-ops.dto';

@Injectable()
export class OverrideLimitsService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: TenantRepository) {}

  async override(actor: AdminRequestContext, tenantId: string, dto: OverrideLimitDto) {
    if (!(await this.repo.exists(tenantId))) throw new TenantNotFoundError(tenantId);   // 404, no enumeration of internals
    return this.pool.withTx(async (client) => {
      const { previous } = await this.repo.upsertLimitOverride(
        client, tenantId, dto.limitCode, dto.limitValue, dto.reason, dto.expiresAt ?? null, actor.userId,
      );
      await this.audit.write(client, {
        actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'tenant.limit_override_set',
        entityType: 'tenant_limit_override', entityId: tenantId,
        oldValue: { limitCode: dto.limitCode, limitValue: previous },
        newValue: { limitCode: dto.limitCode, limitValue: dto.limitValue, expiresAt: dto.expiresAt ?? null },
        reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null,
      });
      return { tenantId, limitCode: dto.limitCode, limitValue: dto.limitValue, expiresAt: dto.expiresAt ?? null, previous };
    });
  }
}
