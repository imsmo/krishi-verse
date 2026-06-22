// modules/ai-governance/services/ai-review.service.ts · the human-in-the-loop (HITL) workflow. A reviewer
// (ai.review) claims a pending item then resolves it accepted/rejected; the decision drives the originating
// module via AiReviewResolved (outbox, in-tx — Law 4). Concurrency: claim/resolve lock the row FOR UPDATE so
// two reviewers can't grab the same item (no version column). A 'rejected' decision marks the linked inference
// as overridden (audit of AI being corrected). Audit on every reviewer action. Money-free.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AiGovernancePublisher } from '../events/ai-governance.publisher';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { AiReview } from '../domain/ai-review.entity';
import { DomainEvent } from '../domain/ai-governance.events';
import { AiReviewRepository } from '../repositories/ai-review.repository';
import { AiInferenceRepository } from '../repositories/ai-inference.repository';
import { ReviewNotFoundError, ReviewAlreadyClaimedError, AiForbiddenError } from '../domain/ai-governance.errors';
import { AiActor } from './ai-inference.service';
import { CreateReviewDto } from '../dto/create-ai-review.dto';
import { ResolveReviewDto } from '../dto/resolve-ai-review.dto';

@Injectable()
export class AiReviewService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly publisher: AiGovernancePublisher,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly reviews: AiReviewRepository,
    private readonly inferences: AiInferenceRepository,
  ) {}

  /** Ops manually raises a HITL item not tied to a specific inference. */
  async enqueueManual(tenantId: string, actor: AiActor, dto: CreateReviewDto) {
    if (!actor.canReview) throw new AiForbiddenError('requires ai.review');
    return timed(this.metrics, 'ai.review.enqueue', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const review = AiReview.enqueue({ id: uuidv7(), tenantId, inferenceId: null, inferenceCreatedAt: null,
          queueKind: dto.queueKind, priority: dto.priority, subjectType: dto.subjectType ?? null, subjectId: dto.subjectId ?? null });
        await this.reviews.insert(tx, review);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'ai.review.enqueued', entityType: 'ai_review', entityId: review.id, newValue: { queueKind: dto.queueKind } });
        await this.flush(tx, tenantId, review.id, review.pullEvents());
        return review.toJSON();
      }, { userId: actor.userId }));
  }

  /** A reviewer takes ownership of a pending item (pending → in_review). */
  async claim(tenantId: string, actor: AiActor, id: string) {
    if (!actor.canReview) throw new AiForbiddenError('requires ai.review');
    return timed(this.metrics, 'ai.review.claim', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const review = await this.reviews.getForUpdate(tx, tenantId, id);
        if (!review) throw new ReviewNotFoundError(id);
        if (review.status !== 'pending') throw new ReviewAlreadyClaimedError(id);
        review.claim(actor.userId);
        await this.reviews.update(tx, review);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'ai.review.claimed', entityType: 'ai_review', entityId: id });
        return review.toJSON();
      }, { userId: actor.userId }));
  }

  /** Resolve a review item; emits AiReviewResolved (originating module acts) and overrides the linked inference on reject. */
  async resolve(tenantId: string, actor: AiActor, id: string, dto: ResolveReviewDto) {
    if (!actor.canReview) throw new AiForbiddenError('requires ai.review');
    return timed(this.metrics, 'ai.review.resolve', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const review = await this.reviews.getForUpdate(tx, tenantId, id);
        if (!review) throw new ReviewNotFoundError(id);
        const p = review.toProps();
        const subject = p.inferenceId ? await this.inferences.subjectInTx(tx, tenantId, p.inferenceId, p.inferenceCreatedAt) : null;
        review.resolve(actor.userId, dto.decision, dto.note ?? null, { subjectType: subject?.subjectType ?? null, subjectId: subject?.subjectId ?? null });
        await this.reviews.update(tx, review);
        // A rejected AI decision = the model was wrong → record the override on the inference audit row.
        if (dto.decision === 'rejected' && p.inferenceId) {
          await this.inferences.markOverridden(tx, tenantId, p.inferenceId, p.inferenceCreatedAt ?? new Date(), actor.userId, dto.note ?? 'review rejected');
        }
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `ai.review.${dto.decision}`, entityType: 'ai_review', entityId: id, newValue: { decision: dto.decision }, reason: dto.note ?? null });
        await this.flush(tx, tenantId, id, review.pullEvents());
        return review.toJSON();
      }, { userId: actor.userId }));
  }

  async getById(tenantId: string, actor: AiActor, id: string) {
    if (!actor.canReview) throw new AiForbiddenError('requires ai.review');
    const review = await this.reviews.getById(tenantId, id);
    if (!review) throw new ReviewNotFoundError(id);
    return review.toJSON();
  }
  async list(tenantId: string, actor: AiActor, q: { box: 'open' | 'all'; status?: any; queueKind?: any; cursor?: { c: string; id: string }; limit: number }) {
    if (!actor.canReview) throw new AiForbiddenError('requires ai.review');
    const rows = await this.reviews.listFor(tenantId, q);
    const items = rows.map((r) => r.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, reviewId: string, evts: DomainEvent[]): Promise<void> {
    await this.publisher.publish(tx, tenantId, 'ai_review', reviewId, evts);
  }
}
