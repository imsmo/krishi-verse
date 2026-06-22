// modules/ai-governance/__tests__/ai-inference.service.spec.ts · service unit tests with fakes.
// Pins: record requires ai.review; below-threshold (or forced) → enqueues a review + emits AiReviewEnqueued in
// the same tx; above-threshold → no review, no event; unknown model code → 404; override marks the inference.
import { AiInferenceService } from '../services/ai-inference.service';
import { AiGovernancePublisher } from '../events/ai-governance.publisher';
import { AiModel } from '../domain/ai-model.entity';
import { AiInference } from '../domain/ai-inference.entity';
import { AiModelNotFoundError, AiForbiddenError, InferenceNotFoundError } from '../domain/ai-governance.errors';

function harness(opts: { model?: AiModel | null; existsReview?: boolean; inference?: AiInference | null } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const model = opts.model === undefined ? AiModel.register({ id: 'm1', code: 'photo_grading', version: 'v1', provider: 'inhouse', confidenceThreshold: 0.8 }) : opts.model;
  const inferences = {
    insert: jest.fn(async () => ({ id: '101', createdAt: new Date('2026-06-01T00:00:00Z') })),
    getForUpdate: jest.fn(async () => opts.inference ?? null),
    markOverridden: jest.fn(),
    subjectInTx: jest.fn(async () => ({ subjectType: 'listing', subjectId: 's1' })),
  };
  const reviews = { existsForInference: jest.fn(async () => opts.existsReview ?? false), insert: jest.fn() };
  const models = { getServingByCode: jest.fn(async () => model) };
  const svc = new AiInferenceService(uow as any, new AiGovernancePublisher(outbox as any), idem as any, metrics as any, inferences as any, reviews as any, models as any);
  return { svc, outbox, inferences, reviews, models };
}
const reviewer = { userId: 'ops1', canReview: true, canModerate: false };
const noAccess = { userId: 'x', canReview: false, canModerate: false };
const base = { modelCode: 'photo_grading', subjectType: 'listing', subjectId: '11111111-1111-1111-1111-111111111111', inputRef: { mediaId: 'm' }, output: { grade: 'A' }, forceReview: false } as any;

describe('record', () => {
  it('requires ai.review', async () => {
    await expect(harness().svc.record('t1', noAccess, 'k1', { ...base, confidence: 0.5 })).rejects.toBeInstanceOf(AiForbiddenError);
  });
  it('below the model threshold → enqueues a review + emits AiReviewEnqueued', async () => {
    const h = harness();
    const out: any = await h.svc.record('t1', reviewer, 'k1', { ...base, confidence: 0.4 });
    expect(out.reviewEnqueued).toBe(true);
    expect(h.reviews.insert).toHaveBeenCalledTimes(1);
    expect(h.outbox.write.mock.calls.some((c) => c[1].eventType === 'ai.review_enqueued')).toBe(true);
  });
  it('above the threshold → no review, no event', async () => {
    const h = harness();
    const out: any = await h.svc.record('t1', reviewer, 'k1', { ...base, confidence: 0.95 });
    expect(out.reviewEnqueued).toBe(false);
    expect(h.reviews.insert).not.toHaveBeenCalled();
    expect(h.outbox.write).not.toHaveBeenCalled();
  });
  it('forceReview enqueues even above the threshold', async () => {
    const h = harness();
    const out: any = await h.svc.record('t1', reviewer, 'k1', { ...base, confidence: 0.99, forceReview: true });
    expect(out.reviewEnqueued).toBe(true);
    expect(h.reviews.insert).toHaveBeenCalledTimes(1);
  });
  it('skips a duplicate review for the same inference (idempotent enqueue)', async () => {
    const h = harness({ existsReview: true });
    await h.svc.record('t1', reviewer, 'k1', { ...base, confidence: 0.1 });
    expect(h.reviews.insert).not.toHaveBeenCalled();
  });
  it('unknown model code → 404', async () => {
    await expect(harness({ model: null }).svc.record('t1', reviewer, 'k1', { ...base, confidence: 0.5 })).rejects.toBeInstanceOf(AiModelNotFoundError);
  });
});

describe('override', () => {
  it('marks the inference overridden when it exists', async () => {
    const inf = AiInference.record({ tenantId: 't1', modelId: 'm1', subjectType: 'listing', subjectId: 's', inputRef: {}, output: {}, confidence: 0.5 });
    const h = harness({ inference: inf });
    const out: any = await h.svc.override('t1', reviewer, '101', { createdAt: '2026-06-01T00:00:00.000Z', reason: 'human says no' } as any);
    expect(out.wasOverridden).toBe(true);
    expect(h.inferences.markOverridden).toHaveBeenCalledTimes(1);
  });
  it('404 when the inference is missing', async () => {
    await expect(harness({ inference: null }).svc.override('t1', reviewer, '999', { createdAt: '2026-06-01T00:00:00.000Z', reason: 'x' } as any)).rejects.toBeInstanceOf(InferenceNotFoundError);
  });
});
