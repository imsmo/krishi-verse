// apps/web-tenant/src/features/ai-review/queue.test.ts · pure unit tests for the AI review-queue helpers.
import { reviewerActions, canResolve, isOpen, isTerminal, validateResolve, validateEnqueue, priorityBucket, openCount } from './queue';

const UID = '11111111-1111-4111-8111-111111111111';

describe('ai-review/queue — action state machine', () => {
  it('offers the right next actions per status (mirrors ai-review.state)', () => {
    expect(reviewerActions('pending')).toEqual(['claim', 'accept', 'reject']);
    expect(reviewerActions('in_review')).toEqual(['accept', 'reject']);
    expect(reviewerActions('accepted')).toEqual([]);
    expect(reviewerActions('rejected')).toEqual([]);
  });
  it('open / terminal / canResolve', () => {
    expect(isOpen('pending')).toBe(true);
    expect(isOpen('in_review')).toBe(true);
    expect(isOpen('accepted')).toBe(false);
    expect(isTerminal('rejected')).toBe(true);
    expect(canResolve('pending')).toBe(true);
    expect(canResolve('accepted')).toBe(false);
  });
});

describe('ai-review/queue — validators', () => {
  it('validateResolve requires a valid decision + bounded note', () => {
    expect(validateResolve({ decision: 'maybe' })).toBe('decision');
    expect(validateResolve({ decision: 'accepted', note: 'x'.repeat(1001) })).toBe('note');
    expect(validateResolve({ decision: 'accepted' })).toBeNull();
    expect(validateResolve({ decision: 'rejected', note: 'low confidence' })).toBeNull();
  });
  it('validateEnqueue bounds queueKind / priority / subjectId', () => {
    expect(validateEnqueue({ queueKind: 'bogus' })).toBe('queueKind');
    expect(validateEnqueue({ queueKind: 'manual', priority: '0' })).toBe('priority');
    expect(validateEnqueue({ queueKind: 'manual', priority: '2000' })).toBe('priority');
    expect(validateEnqueue({ queueKind: 'fraud_flag', subjectId: 'nope' })).toBe('subjectId');
    expect(validateEnqueue({ queueKind: 'fraud_flag', priority: '300', subjectType: 'listing', subjectId: UID })).toBeNull();
    expect(validateEnqueue({ queueKind: 'manual' })).toBeNull();
  });
});

describe('ai-review/queue — presenters', () => {
  it('priorityBucket buckets by urgency', () => {
    expect(priorityBucket(800)).toBe('high');
    expect(priorityBucket(300)).toBe('normal');
    expect(priorityBucket(100)).toBe('low');
  });
  it('openCount counts pending + in_review', () => {
    expect(openCount([{ status: 'pending' }, { status: 'in_review' }, { status: 'accepted' }, { status: 'rejected' }])).toBe(2);
    expect(openCount([])).toBe(0);
  });
});
