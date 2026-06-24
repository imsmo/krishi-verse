// apps/web-tenant/src/test/disputes-manage.spec.ts · unit tests for dispute moderation gating + resolve-payload
// assembly. Gating mirrors the API state machine; resolve validation is the first gate before the authed action.
import { canReview, canEscalate, canResolve, buildResolve } from '../features/disputes/manage';

describe('action gating', () => {
  it('review/escalate/resolve legal while active, not when terminal', () => {
    for (const s of ['open', 'seller_responded']) {
      expect(canReview(s)).toBe(true); expect(canEscalate(s)).toBe(true); expect(canResolve(s)).toBe(true);
    }
    expect(canReview('under_review')).toBe(false);   // already under review
    expect(canEscalate('under_review')).toBe(true);
    expect(canResolve('escalated')).toBe(true);
    for (const s of ['resolved', 'rejected', 'withdrawn', '', undefined, null]) {
      expect(canReview(s as string)).toBe(false); expect(canResolve(s as string)).toBe(false);
    }
  });
});

describe('buildResolve', () => {
  it('requires a positive amount for a partial refund', () => {
    expect(buildResolve({ resolutionType: 'refund_partial', amountMajor: '250.50' })).toEqual({ ok: true, value: { resolutionType: 'refund_partial', resolutionAmountMinor: '25050', note: undefined } });
    expect(buildResolve({ resolutionType: 'refund_partial', amountMajor: '0' })).toEqual({ ok: false, error: 'amount' });
    expect(buildResolve({ resolutionType: 'refund_partial' })).toEqual({ ok: false, error: 'amount' });
  });
  it('allows other types with or without an optional amount', () => {
    expect(buildResolve({ resolutionType: 'refund_full' }).ok).toBe(true);
    expect(buildResolve({ resolutionType: 'rejected', note: 'no proof' })).toEqual({ ok: true, value: { resolutionType: 'rejected', note: 'no proof' } });
    expect(buildResolve({ resolutionType: 'replacement', amountMajor: 'x' })).toEqual({ ok: false, error: 'amount' });
  });
  it('rejects an unknown resolution type', () => {
    expect(buildResolve({ resolutionType: 'hack' })).toEqual({ ok: false, error: 'type' });
    expect(buildResolve({})).toEqual({ ok: false, error: 'type' });
  });
});
