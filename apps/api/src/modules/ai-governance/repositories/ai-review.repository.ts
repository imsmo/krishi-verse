// modules/ai-governance/repositories/ai-review.repository.ts · ai_review_queue (tenant-scoped, uuid PK).
// tenant_id in every query (Law 1) + RLS. No version column → claim/resolve lock the row FOR UPDATE so two
// reviewers can't grab the same item. Open-queue pull is priority-then-age; lists are KEYSET (never OFFSET).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AiReview } from '../domain/ai-review.entity';
import { ReviewStatus, QueueKind } from '../domain/ai-governance.events';

const COLS = `id, tenant_id, inference_id, inference_created_at, queue_kind, priority, status, reviewer_user_id, decision_note, resolved_at, created_at`;
function toDomain(r: any): AiReview {
  return AiReview.rehydrate({ id: r.id, tenantId: r.tenant_id, inferenceId: r.inference_id == null ? null : String(r.inference_id),
    inferenceCreatedAt: r.inference_created_at, queueKind: r.queue_kind, priority: r.priority, status: r.status as ReviewStatus,
    reviewerUserId: r.reviewer_user_id, decisionNote: r.decision_note, resolvedAt: r.resolved_at, createdAt: r.created_at });
}
export interface ReviewListQuery { box: 'open' | 'all'; status?: ReviewStatus; queueKind?: QueueKind; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AiReviewRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, r: AiReview): Promise<void> {
    const p = r.toProps();
    await tx.query(
      `INSERT INTO ai_review_queue (id, tenant_id, inference_id, inference_created_at, queue_kind, priority, status, reviewer_user_id, decision_note, resolved_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)`,
      [p.id, p.tenantId, p.inferenceId, p.inferenceCreatedAt, p.queueKind, p.priority, p.status, p.reviewerUserId, p.decisionNote, p.resolvedAt]);
  }
  /** Idempotency guard: has a review already been enqueued for this inference? (in-tx). */
  async existsForInference(tx: TxContext, tenantId: string, inferenceId: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM ai_review_queue WHERE tenant_id=$1 AND inference_id=$2 LIMIT 1`, [tenantId, inferenceId]);
    return (r.rowCount ?? 0) > 0;
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<AiReview | null> {
    const r = await tx.query(`SELECT ${COLS} FROM ai_review_queue WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<AiReview | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ai_review_queue WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, r: AiReview): Promise<void> {
    const p = r.toProps();
    await tx.query(`UPDATE ai_review_queue SET status=$3, reviewer_user_id=$4, decision_note=$5, resolved_at=$6, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.status, p.reviewerUserId, p.decisionNote, p.resolvedAt]);
  }
  async listFor(tenantId: string, q: ReviewListQuery): Promise<AiReview[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'open') where += ` AND status IN ('pending','in_review')`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.queueKind) where += ` AND queue_kind=${p(q.queueKind)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM ai_review_queue WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
