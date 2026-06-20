// modules/ai-governance/__tests__/ai-governance-domain.spec.ts · pure-domain invariants + the three state
// machines (legal + illegal transitions), 100% branch intent. No I/O.
import { AiModel } from '../domain/ai-model.entity';
import { AiInference } from '../domain/ai-inference.entity';
import { AiReview } from '../domain/ai-review.entity';
import { ModerationReport } from '../domain/moderation-report.entity';
import * as modelState from '../domain/ai-model.state';
import * as reviewState from '../domain/ai-review.state';
import * as modState from '../domain/moderation.state';
import { InvalidAiModelError, InvalidInferenceError, InvalidModerationError } from '../domain/ai-governance.errors';

describe('AiModel + lifecycle state machine', () => {
  it('registers with defaults + validates threshold range', () => {
    const m = AiModel.register({ id: 'm1', code: 'photo_grading', version: 'v1', provider: 'inhouse', confidenceThreshold: 0.7 });
    expect(m.status).toBe('shadow');
    expect(() => AiModel.register({ id: 'm2', code: 'x', version: 'v1', provider: null, confidenceThreshold: 1.5 })).toThrow(InvalidAiModelError);
    expect(() => AiModel.register({ id: 'm3', code: '', version: 'v1', provider: null, confidenceThreshold: null })).toThrow(InvalidAiModelError);
  });
  it('needsReview compares confidence to the threshold; no threshold = never; no confidence = always', () => {
    const m = AiModel.register({ id: 'm1', code: 'c', version: 'v1', provider: null, confidenceThreshold: 0.8 });
    expect(m.needsReview(0.5)).toBe(true);
    expect(m.needsReview(0.9)).toBe(false);
    expect(m.needsReview(null)).toBe(true);
    const noThreshold = AiModel.register({ id: 'm2', code: 'c', version: 'v2', provider: null, confidenceThreshold: null });
    expect(noThreshold.needsReview(0.1)).toBe(false);
  });
  it('promote follows the ladder; illegal transition throws; retire is terminal + emits', () => {
    const m = AiModel.register({ id: 'm1', code: 'c', version: 'v1', provider: null, confidenceThreshold: 0.5 });
    m.promote('canary'); m.promote('production');
    expect(m.status).toBe('production');
    m.retire();
    expect(m.status).toBe('retired');
    expect(m.pullEvents().some((e) => e.type === 'ai.model_retired')).toBe(true);
    expect(() => m.promote('production')).toThrow(modelState.IllegalModelTransitionError);   // retired is terminal
  });
  it('state machine: canTransition matrix', () => {
    expect(modelState.canTransition('shadow', 'production')).toBe(true);
    expect(modelState.canTransition('production', 'shadow')).toBe(true);
    expect(modelState.canTransition('retired', 'shadow')).toBe(false);
    expect(modelState.isServing('production')).toBe(true);
    expect(modelState.isServing('shadow')).toBe(false);
  });
});

describe('AiInference invariants', () => {
  it('requires subject + valid confidence, and rejects PII in input_ref', () => {
    expect(() => AiInference.record({ tenantId: 't1', modelId: 'm1', subjectType: '', subjectId: 's', inputRef: {}, output: {}, confidence: 0.5 })).toThrow(InvalidInferenceError);
    expect(() => AiInference.record({ tenantId: 't1', modelId: 'm1', subjectType: 'listing', subjectId: 's', inputRef: {}, output: {}, confidence: 2 })).toThrow(InvalidInferenceError);
    expect(() => AiInference.record({ tenantId: 't1', modelId: 'm1', subjectType: 'listing', subjectId: 's', inputRef: { phone: '999' }, output: {}, confidence: 0.5 })).toThrow(/PII/);
  });
  it('records a valid inference (pointers only)', () => {
    const i = AiInference.record({ tenantId: 't1', modelId: 'm1', subjectType: 'listing', subjectId: 's', inputRef: { mediaId: 'x' }, output: { grade: 'A' }, confidence: 0.42 });
    expect(i.confidence).toBe(0.42); expect(i.toProps().wasOverridden).toBe(false);
    i.markOverridden('u1', 'wrong'); expect(i.toProps().wasOverridden).toBe(true);
  });
});

describe('AiReview state machine', () => {
  const make = () => AiReview.enqueue({ id: 'r1', tenantId: 't1', inferenceId: '10', inferenceCreatedAt: new Date(), queueKind: 'low_confidence_grade', subjectType: 'listing', subjectId: 's' });
  it('enqueue emits ai.review_enqueued; claim then resolve emits ai.review_resolved', () => {
    const r = make();
    expect(r.pullEvents().some((e) => e.type === 'ai.review_enqueued')).toBe(true);
    r.claim('rev1'); expect(r.status).toBe('in_review');
    r.resolve('rev1', 'accepted', 'ok', { subjectType: 'listing', subjectId: 's' });
    expect(r.status).toBe('accepted');
    expect(r.pullEvents().some((e) => e.type === 'ai.review_resolved')).toBe(true);
  });
  it('illegal transitions throw; accepted is terminal', () => {
    const r = make();
    r.claim('rev1'); r.resolve('rev1', 'rejected', null, { subjectType: null, subjectId: null });
    expect(() => r.claim('rev2')).toThrow(reviewState.IllegalReviewTransitionError);
    expect(reviewState.isTerminal('rejected')).toBe(true);
    expect(reviewState.isOpen('pending')).toBe(true);
  });
});

describe('ModerationReport state machine', () => {
  const make = () => ModerationReport.file({ id: 'rep1', tenantId: 't1', reporterUserId: 'u1', subjectType: 'listing', subjectId: 's', reasonId: 'reason1', details: null });
  it('file rejects unknown subject type + emits ModerationFiled', () => {
    expect(() => ModerationReport.file({ id: 'x', tenantId: 't1', reporterUserId: 'u1', subjectType: 'spaceship', subjectId: 's', reasonId: 'r' })).toThrow(InvalidModerationError);
    const r = make();
    expect(r.pullEvents().some((e) => e.type === 'ai.moderation_filed')).toBe(true);
  });
  it('actioned requires an action; dismissed does not; both terminal + emit', () => {
    const a = make();
    expect(() => a.handle('mod1', 'actioned', null)).toThrow(InvalidModerationError);
    a.handle('mod1', 'actioned', 'removed');
    expect(a.status).toBe('actioned'); expect(a.toProps().actionTaken).toBe('removed');
    expect(a.pullEvents().some((e) => e.type === 'ai.moderation_actioned')).toBe(true);
    expect(() => a.handle('mod1', 'dismissed', null)).toThrow(modState.IllegalModerationTransitionError);
    const d = make(); d.pullEvents();
    d.handle('mod2', 'dismissed', null); expect(d.status).toBe('dismissed'); expect(d.toProps().actionTaken).toBeNull();
  });
});
