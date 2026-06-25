// Unit tests for the PURE seller-review-response validator.
import { validateReviewResponse } from '../features/reviews/respond';

describe('validateReviewResponse', () => {
  it('trims and accepts a valid response', () => {
    expect(validateReviewResponse('  Thanks for your feedback!  ')).toEqual({ ok: true, value: 'Thanks for your feedback!' });
  });
  it('rejects empty / blank / nullish', () => {
    expect(validateReviewResponse('')).toEqual({ ok: false, error: 'empty' });
    expect(validateReviewResponse('   ')).toEqual({ ok: false, error: 'empty' });
    expect(validateReviewResponse(null)).toEqual({ ok: false, error: 'empty' });
    expect(validateReviewResponse(undefined)).toEqual({ ok: false, error: 'empty' });
  });
  it('rejects > 4000 chars (after trim)', () => {
    expect(validateReviewResponse('a'.repeat(4001))).toEqual({ ok: false, error: 'too_long' });
    expect(validateReviewResponse('a'.repeat(4000))).toEqual({ ok: true, value: 'a'.repeat(4000) });
  });
});
