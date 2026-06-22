// modules/ai-governance/__tests__/ai-review.service.spec.ts · HITL workflow unit tests with fakes.
// Pins: claim requires ai.review + transitions pending→in_review; double-claim → 409; resolve emits
// AiReviewResolved + audits + (on reject) overrides the linked inference; missing item → 404.
import { AiReviewService } from '../services/ai-review.service';
import { AiGovernancePublisher } from '../events/ai-governance.publisher';
import { AiReview } from '../domain/ai-review.entity';
import { ReviewNotFoundError, ReviewAlreadyClaimedError, AiForbiddenError } from '../domain/ai-governance.errors';

function review(status: 'pending' | 'in_review' = 'pending', inferenceId: string | null = '50') {
  return AiReview.rehydrate({ id: 'r1', tenantId: 't1', inferenceId, inferenceCreatedAt: new Date('2026-06-01T00:00:00Z'),
    queueKind: 'low_confidence_grade', priority: 50, status, reviewerUserId: null, decisionNote: null, resolvedAt: null });
}
function harness(opts: { review?: AiReview | null } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn() };
  const reviews = { getForUpdate: jest.fn(async () => (opts.review === undefined ? review() : opts.review)), update: jest.fn(), insert: jest.fn(), getById: jest.fn(async () => opts.review ?? null), listFor: jest.fn() };
  const inferences = { subjectInTx: jest.fn(async () => ({ subjectType: 'listing', subjectId: 's1' })), markOverridden: jest.fn() };
  const svc = new AiReviewService(uow as any, new AiGovernancePublisher(outbox as any), metrics as any, audit as any, reviews as any, inferences as any);
  return { svc, outbox, audit, reviews, inferences };
}
const reviewer = { userId: 'ops1', canReview: true, canModerate: false };
const noAccess = { userId: 'x', canReview: false, canModerate: false };

describe('claim', () => {
  it('requires ai.review', async () => {
    await expect(harness().svc.claim('t1', noAccess, 'r1')).rejects.toBeInstanceOf(AiForbiddenError);
  });
  it('transitions pending → in_review + audits', async () => {
    const h = harness();
    const out: any = await h.svc.claim('t1', reviewer, 'r1');
    expect(out.status).toBe('in_review');
    expect(h.reviews.update).toHaveBeenCalledTimes(1);
    expect(h.audit.write).toHaveBeenCalledTimes(1);
  });
  it('double-claim (not pending) → 409', async () => {
    await expect(harness({ review: review('in_review') }).svc.claim('t1', reviewer, 'r1')).rejects.toBeInstanceOf(ReviewAlreadyClaimedError);
  });
  it('missing item → 404', async () => {
    await expect(harness({ review: null }).svc.claim('t1', reviewer, 'nope')).rejects.toBeInstanceOf(ReviewNotFoundError);
  });
});

describe('resolve', () => {
  it('emits AiReviewResolved with the linked inference subject', async () => {
    const h = harness({ review: review('in_review') });
    await h.svc.resolve('t1', reviewer, 'r1', { decision: 'accepted', note: 'ok' } as any);
    const ev = h.outbox.write.mock.calls.find((c) => c[1].eventType === 'ai.review_resolved');
    expect(ev).toBeTruthy();
    expect(ev![1].payload).toMatchObject({ decision: 'accepted', subjectType: 'listing', subjectId: 's1' });
  });
  it('a rejected decision overrides the linked inference', async () => {
    const h = harness({ review: review('in_review', '77') });
    await h.svc.resolve('t1', reviewer, 'r1', { decision: 'rejected', note: 'wrong' } as any);
    expect(h.inferences.markOverridden).toHaveBeenCalledTimes(1);
  });
});
