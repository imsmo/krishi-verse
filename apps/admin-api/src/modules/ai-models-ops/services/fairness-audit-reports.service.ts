// apps/admin-api/src/modules/ai-models-ops/services/fairness-audit-reports.service.ts · the governance read:
// the stored monthly fairness_audit (written by apps/api's fairness-audit job) PLUS a fresh roll-up of the last
// 30 days of the inference audit log (total / overridden / low-confidence + override rate). Read-only; records a
// standalone access-audit entry (sensitive cross-tenant data view).
import { Injectable } from '@nestjs/common';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { AiModelRepository } from '../repositories/ai-model.repository';
import { AiModelNotFoundError } from '../domain/ai-models.errors';

@Injectable()
export class FairnessAuditReportsService {
  constructor(private readonly audit: AdminAuditWriter, private readonly repo: AiModelRepository) {}

  async report(actor: AdminRequestContext, id: string) {
    const model = await this.repo.getById(id);
    if (!model) throw new AiModelNotFoundError(id);
    const recent = await this.repo.recentInferenceStats(id, 30);
    const overrideRate = recent.total > 0 ? Math.round((recent.overridden / recent.total) * 10000) / 10000 : 0;
    await this.audit.log({ actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'ai.model.fairness_viewed', entityType: 'ai_model', entityId: id, ip: actor.ip, requestId: actor.requestId || null });
    return { model: model.toJSON(), storedFairnessAudit: model.toProps().fairnessAudit, recent: { window: '30d', ...recent, overrideRate } };
  }
}
