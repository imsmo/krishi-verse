// apps/admin-api/src/modules/ai-models-ops/services/threshold-tuning.service.ts · adjust a model's
// confidence_threshold (the line below which apps/api routes an inference to human review). One ACID tx +
// audit-in-tx (old→new threshold + reason). Locks the row FOR UPDATE.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { AiModelRepository } from '../repositories/ai-model.repository';
import { AiModelNotFoundError } from '../domain/ai-models.errors';
import { TuneThresholdDto } from '../dto/ai-models-ops.dto';

@Injectable()
export class ThresholdTuningService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: AiModelRepository) {}

  async tune(actor: AdminRequestContext, id: string, dto: TuneThresholdDto) {
    return this.pool.withTx(async (client) => {
      const model = await this.repo.getForUpdate(client, id);
      if (!model) throw new AiModelNotFoundError(id);
      const change = model.tuneThreshold(dto.confidenceThreshold);     // validates [0,1]
      await this.repo.updateThreshold(client, id, change.to, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'ai.model.threshold_tuned',
        entityType: 'ai_model', entityId: id, oldValue: { confidenceThreshold: change.from }, newValue: { confidenceThreshold: change.to }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return model.toJSON();
    });
  }
}
