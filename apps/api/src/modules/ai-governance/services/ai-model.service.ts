// modules/ai-governance/services/ai-model.service.ts · READ-ONLY model registry use-cases (browse + get).
// The registry (ai_models) is GLOBAL and shared across tenants; authoring/promotion is a platform/admin-api
// concern (Law 11) and is intentionally NOT exposed here. Reads require ai.review (AI Ops).
import { Injectable } from '@nestjs/common';
import { AiModelRepository } from '../repositories/ai-model.repository';
import { AiModelNotFoundError } from '../domain/ai-governance.errors';
import { ModelStatus } from '../domain/ai-governance.events';

@Injectable()
export class AiModelService {
  constructor(private readonly models: AiModelRepository) {}

  async getById(tenantId: string, id: string) {
    const m = await this.models.getById(tenantId, id);
    if (!m) throw new AiModelNotFoundError(id);
    return m.toJSON();
  }
  async list(tenantId: string, q: { code?: string; status?: ModelStatus; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.models.list(tenantId, { code: q.code, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((m) => m.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
