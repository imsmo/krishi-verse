// apps/admin-api/src/modules/ai-models-ops/services/model-registry.service.ts · god-mode model lifecycle.
// register / promote (shadow→canary→production→retired) the GLOBAL ai_models registry. One ACID tx per write
// (Law 4); every state change writes an append-only audit_log row IN THE SAME TX (§4). Status transitions go
// only through the entity's state machine (Law 5). Authorization is enforced at the controller (owner perm +
// hardware-key + step-up); the service records the actor.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { AiModel } from '../domain/ai-model.entity';
import { AiModelRepository, ModelListQuery } from '../repositories/ai-model.repository';
import { AiModelNotFoundError } from '../domain/ai-models.errors';
import { RegisterModelDto, PromoteModelDto } from '../dto/ai-models-ops.dto';

@Injectable()
export class ModelRegistryService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: AiModelRepository) {}

  async register(actor: AdminRequestContext, dto: RegisterModelDto) {
    const model = AiModel.register({ id: randomUUID(), code: dto.code, version: dto.version, provider: dto.provider ?? null, confidenceThreshold: dto.confidenceThreshold ?? null });
    return this.pool.withTx(async (client) => {
      await this.repo.insert(client, model, actor.userId);
      const p = model.toProps();
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'ai.model.registered',
        entityType: 'ai_model', entityId: p.id, newValue: { code: p.code, version: p.version, status: p.status, confidenceThreshold: p.confidenceThreshold }, ip: actor.ip, requestId: actor.requestId || null });
      return model.toJSON();
    });
  }

  async promote(actor: AdminRequestContext, id: string, dto: PromoteModelDto) {
    return this.pool.withTx(async (client) => {
      const model = await this.repo.getForUpdate(client, id);
      if (!model) throw new AiModelNotFoundError(id);
      const change = model.promote(dto.to);                 // throws IllegalModelTransitionError on illegal move
      await this.repo.updateStatus(client, id, change.to, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: dto.to === 'retired' ? 'ai.model.retired' : 'ai.model.promoted', entityType: 'ai_model', entityId: id,
        oldValue: { status: change.from }, newValue: { status: change.to }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return model.toJSON();
    });
  }

  async getById(id: string) {
    const m = await this.repo.getById(id);
    if (!m) throw new AiModelNotFoundError(id);
    return m.toJSON();
  }
  async list(q: ModelListQuery) {
    const rows = await this.repo.list(q);
    const items = rows.map((m) => m.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
