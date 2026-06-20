// modules/ai-governance/repositories/ai-model.repository.ts · ai_models (GLOBAL — no tenant_id; the model
// registry is shared across the platform). READ-ONLY in the tenant API (browse the live registry + resolve the
// model that serves a given code); authoring/promotion is admin-api (Law 11). Reads on the replica; keyset
// pagination (never OFFSET). Parameterised SQL only.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AiModel } from '../domain/ai-model.entity';
import { ModelStatus } from '../domain/ai-governance.events';

const COLS = `id, code, version, provider, status, confidence_threshold, fairness_audit, created_at`;
function toDomain(r: any): AiModel {
  return AiModel.rehydrate({ id: r.id, code: r.code, version: r.version, provider: r.provider, status: r.status as ModelStatus,
    confidenceThreshold: r.confidence_threshold == null ? null : Number(r.confidence_threshold), fairnessAudit: r.fairness_audit ?? null, createdAt: r.created_at });
}
export interface ModelListQuery { code?: string; status?: ModelStatus; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AiModelRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  // ai_models is GLOBAL (no tenant_id, no RLS). Reads route through the caller's shard replica via
  // forTenant(tenantId) for shard placement; the rows themselves are tenant-agnostic.
  async getById(tenantId: string, id: string): Promise<AiModel | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ai_models WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Resolve the model that currently serves a code: prefer production, else canary. Read in-tx for consistency. */
  async getServingByCode(tx: TxContext, code: string): Promise<AiModel | null> {
    const r = await tx.query(
      `SELECT ${COLS} FROM ai_models WHERE code=$1 AND status IN ('production','canary') AND deleted_at IS NULL
        ORDER BY (status='production') DESC, created_at DESC LIMIT 1`, [code]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, q: ModelListQuery): Promise<AiModel[]> {
    const params: unknown[] = []; let where = `deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.code) where += ` AND code=${p(q.code)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ai_models WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
