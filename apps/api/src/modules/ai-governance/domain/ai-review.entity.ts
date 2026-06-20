// modules/ai-governance/domain/ai-review.entity.ts · a human-in-the-loop review item (ai_review_queue,
// tenant-scoped). Pure domain. Created when an inference is below its model's confidence threshold (or flagged
// by a job). A reviewer claims it then resolves it accepted/rejected; status moves ONLY through
// ai-review.state.ts (Law 5). No version column → the repo locks the row FOR UPDATE on claim/resolve.
// The subject (listing/message/…) lives on the linked inference, not on the queue row — it is passed through
// to the outbox events so the originating module can act on a resolution.
import { ReviewStatus, ReviewDecision, QueueKind, DomainEvent, AiEventType } from './ai-governance.events';
import { assertTransition } from './ai-review.state';

export interface SubjectRef { subjectType: string | null; subjectId: string | null; }
export interface AiReviewProps {
  id: string; tenantId: string | null; inferenceId: string | null; inferenceCreatedAt: Date | null;
  queueKind: QueueKind | string; priority: number; status: ReviewStatus;
  reviewerUserId: string | null; decisionNote: string | null; resolvedAt: Date | null; createdAt?: Date;
}
export class AiReview {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: AiReviewProps) {}

  static enqueue(input: { id: string; tenantId: string | null; inferenceId: string | null; inferenceCreatedAt: Date | null;
    queueKind: QueueKind | string; priority?: number; } & SubjectRef): AiReview {
    const r = new AiReview({ id: input.id, tenantId: input.tenantId, inferenceId: input.inferenceId, inferenceCreatedAt: input.inferenceCreatedAt,
      queueKind: input.queueKind, priority: input.priority ?? 100, status: 'pending', reviewerUserId: null, decisionNote: null, resolvedAt: null });
    r.events.push({ type: AiEventType.ReviewEnqueued, payload: { reviewId: r.props.id, queueKind: r.props.queueKind, subjectType: input.subjectType, subjectId: input.subjectId } });
    return r;
  }
  static rehydrate(p: AiReviewProps): AiReview { return new AiReview(p); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  toProps(): Readonly<AiReviewProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** A reviewer takes ownership (pending → in_review). */
  claim(reviewerUserId: string): void {
    assertTransition(this.props.status, 'in_review');
    this.props.status = 'in_review';
    this.props.reviewerUserId = reviewerUserId;
  }
  /** Resolve the item; the decision + subject drive the originating module via the outbox. */
  resolve(reviewerUserId: string, decision: ReviewDecision, note: string | null, subject: SubjectRef, now = new Date()): void {
    assertTransition(this.props.status, decision);
    this.props.status = decision;
    this.props.reviewerUserId = reviewerUserId;
    this.props.decisionNote = note;
    this.props.resolvedAt = now;
    this.events.push({ type: AiEventType.ReviewResolved, payload: { reviewId: this.props.id, decision, queueKind: this.props.queueKind, subjectType: subject.subjectType, subjectId: subject.subjectId, reviewerUserId } });
  }
  toJSON() {
    const v = this.props;
    return { id: v.id, inferenceId: v.inferenceId, queueKind: v.queueKind, priority: v.priority, status: v.status,
      reviewerUserId: v.reviewerUserId, decisionNote: v.decisionNote, resolvedAt: v.resolvedAt, createdAt: v.createdAt };
  }
}
