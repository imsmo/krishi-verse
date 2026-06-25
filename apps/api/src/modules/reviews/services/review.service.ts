// modules/reviews/services/review.service.ts
// Review use-cases. Every write: one ACID tx (UoW), status via the machine (Law 5), outbox events in
// the SAME tx (Law 4), audit on moderation. NO money. Reviews are VERIFIED-PURCHASE only: the target
// (seller↔buyer) is resolved from the order's eligibility row (recorded when the order completed) —
// the client never supplies target_id, and a non-party can't review (anti-IDOR / anti-spam). No version
// column → mutations lock the row FOR UPDATE; the (order, reviewer, target) UNIQUE stops duplicates.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { CACHE_SERVICE, CacheService } from '../../../core/cache/cache.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Review } from '../domain/review.entity';
import { DomainEvent, ReviewTargetType } from '../domain/reviews.events';
import { ReviewNotFoundError, ReviewForbiddenError, NotEligibleToReviewError, DuplicateReviewError } from '../domain/reviews.errors';
import { ReviewRepository } from '../repositories/review.repository';
import { CreateReviewDto } from '../dto/create-review.dto';
import { EditReviewDto, SellerResponseDto, ModerateReviewDto } from '../dto/update-review.dto';

export interface ReviewActor { userId: string; canModerate: boolean; }
const summaryKey = (tenantId: string, tt: string, ti: string) => `reviews:sum:${tenantId}:${tt}:${ti}`;

@Injectable()
export class ReviewService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: ReviewRepository,
  ) {}

  /** A party to a completed order reviews the counterparty (verified purchase). */
  async submit(tenantId: string, reviewerUserId: string, idemKey: string, dto: CreateReviewDto) {
    return this.idem.remember(idemKey, reviewerUserId, 'reviews.submit', () =>
      timed(this.metrics, 'reviews.submit', { tenant: tenantId }, async () => {
        const elig = await this.repo.eligibilityFor(tenantId, dto.orderId);
        if (!elig) throw new NotEligibleToReviewError();
        // resolve the target from the eligibility — the reviewer is the buyer or the seller of that order
        let targetType: ReviewTargetType; let targetId: string;
        if (reviewerUserId === elig.buyerUserId) { targetType = 'seller'; targetId = elig.sellerUserId; }
        else if (reviewerUserId === elig.sellerUserId) { targetType = 'buyer'; targetId = elig.buyerUserId; }
        else throw new NotEligibleToReviewError();

        const review = Review.submit({
          id: uuidv7(), tenantId, orderId: dto.orderId, reviewerUserId, targetType, targetId,
          stars: dto.stars, subRatings: dto.subRatings ?? {}, body: dto.body ?? null, tags: dto.tags ?? [],
        });
        const res = await this.uow.run(tenantId, async (tx) => {
          const inserted = await this.repo.insert(tx, review);
          if (!inserted) throw new DuplicateReviewError();
          const p = review.toProps();
          await this.flush(tx, tenantId, p.id, review.pullEvents());
          return this.serialize(p);
        }, { userId: reviewerUserId });
        await this.cache.del(summaryKey(tenantId, targetType, targetId));
        return res;
      }));
  }

  /** The author edits their own review. */
  async edit(tenantId: string, actor: ReviewActor, id: string, dto: EditReviewDto) {
    const out = await this.uow.run(tenantId, async (tx) => {
      const review = await this.repo.getForUpdate(tx, tenantId, id);
      if (!review) throw new ReviewNotFoundError(id);
      if (review.reviewerUserId !== actor.userId) throw new ReviewForbiddenError('only the author may edit this review');
      review.edit({ stars: dto.stars, subRatings: dto.subRatings, body: dto.body, tags: dto.tags });
      await this.repo.update(tx, review);
      await this.flush(tx, tenantId, id, review.pullEvents());
      return this.serialize(review.toProps());
    }, { userId: actor.userId });
    await this.cache.del(summaryKey(tenantId, out.targetType, out.targetId));
    return out;
  }

  /** The reviewed party (target) responds publicly to the review. */
  async respond(tenantId: string, actor: ReviewActor, id: string, dto: SellerResponseDto) {
    return this.uow.run(tenantId, async (tx) => {
      const review = await this.repo.getForUpdate(tx, tenantId, id);
      if (!review) throw new ReviewNotFoundError(id);
      if (review.targetId !== actor.userId && !actor.canModerate) throw new ReviewForbiddenError('only the reviewed party may respond');
      review.sellerRespond(dto.response);
      await this.repo.update(tx, review);
      await this.flush(tx, tenantId, id, review.pullEvents());
      return this.serialize(review.toProps());
    }, { userId: actor.userId });
  }

  /** Moderator hides/restores/flags/removes a review. */
  async moderate(tenantId: string, actor: ReviewActor, id: string, dto: ModerateReviewDto, ip: string | null) {
    if (!actor.canModerate) throw new ReviewForbiddenError('requires review.moderate');
    const out = await this.uow.run(tenantId, async (tx) => {
      const review = await this.repo.getForUpdate(tx, tenantId, id);
      if (!review) throw new ReviewNotFoundError(id);
      review.moderate(dto.action);
      await this.repo.update(tx, review);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `review.${dto.action}`, entityType: 'review', entityId: id, newValue: { status: review.status }, reason: dto.reason ?? null, ip });
      await this.flush(tx, tenantId, id, review.pullEvents());
      return this.serialize(review.toProps());
    }, { userId: actor.userId });
    await this.cache.del(summaryKey(tenantId, out.targetType, out.targetId));
    return out;
  }

  /** A published review is public; a non-published one is visible only to its author/target/moderator
   *  (404 — not 403 — to everyone else, so reviews can't be enumerated by id). */
  async getById(tenantId: string, actor: ReviewActor, id: string) {
    const review = await this.repo.getById(tenantId, id);
    if (!review) throw new ReviewNotFoundError(id);
    const p = review.toProps();
    const isParty = p.reviewerUserId === actor.userId || p.targetId === actor.userId || actor.canModerate;
    if (p.status !== 'published' && !isParty) throw new ReviewNotFoundError(id);
    return this.serialize(p);
  }

  async list(tenantId: string, actor: ReviewActor, q: { box: 'target' | 'mine'; targetType?: string; targetId?: string; cursor?: { c: string; id: string }; limit: number }) {
    let rows: Review[];
    if (q.box === 'mine') rows = await this.repo.listForReviewer(tenantId, actor.userId, { cursor: q.cursor, limit: q.limit });
    else {
      if (!q.targetType || !q.targetId) throw new ReviewForbiddenError('targetType and targetId are required');
      rows = await this.repo.listForTarget(tenantId, q.targetType, q.targetId, { cursor: q.cursor, limit: q.limit });
    }
    const items = rows.map((r) => this.serialize(r.toProps()));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  /** Cached aggregate (avg + count + histogram) for a target's published reviews. */
  async summary(tenantId: string, targetType: string, targetId: string) {
    return this.cache.wrap(summaryKey(tenantId, targetType, targetId), 120, () => this.repo.summaryForTarget(tenantId, targetType, targetId));
  }

  /** PUBLIC, anonymous-safe list of a target's PUBLISHED reviews. Carries NO buyer PII (no reviewer id) — only
   *  the rating, body, verified-purchase flag and the seller's public response. Keyset paginated. */
  async publicList(tenantId: string, q: { targetType: string; targetId: string; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listForTarget(tenantId, q.targetType, q.targetId, { cursor: q.cursor, limit: q.limit });
    const items = rows.map((r) => this.publicSerialize(r.toProps()));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  /** PII-free public projection: explicitly OMITS reviewerUserId/orderId so a public reader can't tie a review to
   *  a buyer or enumerate their orders. Only published reviews reach this path (listForTarget filters status). */
  private publicSerialize(p: ReturnType<Review['toProps']>) {
    return { id: p.id, stars: p.stars, subRatings: p.subRatings, body: p.body, tags: p.tags,
      isVerifiedPurchase: p.isVerifiedPurchase, sellerResponse: p.sellerResponse, sellerRespondedAt: p.sellerRespondedAt,
      helpfulCount: p.helpfulCount, createdAt: p.createdAt };
  }

  private serialize(p: ReturnType<Review['toProps']>) {
    return { id: p.id, orderId: p.orderId, reviewerUserId: p.reviewerUserId, targetType: p.targetType, targetId: p.targetId,
      stars: p.stars, subRatings: p.subRatings, body: p.body, tags: p.tags, isVerifiedPurchase: p.isVerifiedPurchase,
      status: p.status, sellerResponse: p.sellerResponse, sellerRespondedAt: p.sellerRespondedAt, helpfulCount: p.helpfulCount, createdAt: p.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, reviewId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'review', aggregateId: reviewId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
