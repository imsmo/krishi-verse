// apps/admin-api/src/modules/ai-models-ops/repositories/ai-model.repository.ts · ALL SQL for the GLOBAL
// ai_models registry (no tenant_id — platform-wide). Writes run in the caller's tx (PoolClient); reads on the
// admin pool. Parameterised only. No version column on ai_models → mutations lock the row FOR UPDATE. Keyset
// pagination (never OFFSET). Also rolls up recent ai_inferences for the fairness report.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { AiModel } from '../domain/ai-model.entity';
import { ModelStatus } from '../domain/ai-model.state';
import { DuplicateAiModelError } from '../domain/ai-models.errors';

const COLS = `id, code, version, provider, status, confidence_threshold, fairness_audit, created_at`;
function toDomain(r: any): AiModel {
  return AiModel.rehydrate({ id: r.id, code: r.code, version: r.version, provider: r.provider, status: r.status as ModelStatus,
    confidenceThreshold: r.confidence_threshold == null ? null : Number(r.confidence_threshold), fairnessAudit: r.fairness_audit ?? null, createdAt: r.created_at });
}
export interface ModelListQuery { code?: string; status?: ModelStatus; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AiModelRepository {
  constructor(private readonly pool: AdminPool) {}

  async insert(client: PoolClient, m: AiModel, actorUserId: string): Promise<void> {
    const p = m.toProps();
    try {
      await client.query(
        `INSERT INTO ai_models (id, code, version, provider, status, confidence_threshold, fairness_audit, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [p.id, p.code, p.version, p.provider, p.status, p.confidenceThreshold, p.fairnessAudit ? JSON.stringify(p.fairnessAudit) : null, actorUserId]);
    } catch (e: any) {
      if (e?.code === '23505') throw new DuplicateAiModelError(p.code, p.version);   // UNIQUE (code, version)
      throw e;
    }
  }
  async getForUpdate(client: PoolClient, id: string): Promise<AiModel | null> {
    const r = await client.query(`SELECT ${COLS} FROM ai_models WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async updateStatus(client: PoolClient, id: string, status: ModelStatus, actorUserId: string): Promise<void> {
    await client.query(`UPDATE ai_models SET status=$2, updated_by=$3, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [id, status, actorUserId]);
  }
  async updateThreshold(client: PoolClient, id: string, threshold: number | null, actorUserId: string): Promise<void> {
    await client.query(`UPDATE ai_models SET confidence_threshold=$2, updated_by=$3, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [id, threshold, actorUserId]);
  }
  async getById(id: string): Promise<AiModel | null> {
    const r = await this.pool.query(`SELECT ${COLS} FROM ai_models WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(q: ModelListQuery): Promise<AiModel[]> {
    const params: unknown[] = []; let where = `deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.code) where += ` AND code=${p(q.code)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${COLS} FROM ai_models WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
  /** Roll up the last N days of the inference audit log for a model (for the fairness report). Bounded window. */
  async recentInferenceStats(modelId: string, days = 30): Promise<{ total: number; overridden: number; lowConfidence: number }> {
    const r = await this.pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE was_overridden)::int AS overridden,
              count(*) FILTER (WHERE confidence IS NOT NULL AND confidence < 0.5)::int AS low_confidence
         FROM ai_inferences WHERE model_id=$1 AND created_at >= now() - ($2 || ' days')::interval`, [modelId, days]);
    const row = r.rows[0] ?? {};
    return { total: row.total ?? 0, overridden: row.overridden ?? 0, lowConfidence: row.low_confidence ?? 0 };
  }
}
