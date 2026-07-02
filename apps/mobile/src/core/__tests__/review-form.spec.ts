// Unit tests for the PURE review-form logic (features/reviews/review-form). No React/SDK deps.
import { ratingLabelKey, ratingNumber, toggleTag, bodyRemaining, canSubmitReview, REVIEW_TAGS, REVIEW_TAGS_MAX, REVIEW_BODY_MAX } from '../../features/reviews/review-form';

describe('ratingLabelKey / ratingNumber', () => {
  it('maps 1–5 stars to the design quality words; 0 → empty', () => {
    expect(ratingLabelKey(4)).toBe('very_good');
    expect(ratingLabelKey(5)).toBe('excellent');
    expect(ratingLabelKey(1)).toBe('poor');
    expect(ratingLabelKey(0)).toBe('');
  });
  it('prints the chosen rating with one decimal (user input, not a server value)', () => {
    expect(ratingNumber(4)).toBe('4.0');
    expect(ratingNumber(0)).toBe('0.0');
  });
});

describe('toggleTag', () => {
  it('adds then removes a code', () => {
    expect(toggleTag([], 'on_time')).toEqual(['on_time']);
    expect(toggleTag(['on_time'], 'on_time')).toEqual([]);
  });
  it('never exceeds the server tag cap', () => {
    const full = Array.from({ length: REVIEW_TAGS_MAX }, (_, i) => 'tag_' + i);
    expect(toggleTag(full, 'extra')).toHaveLength(REVIEW_TAGS_MAX);
    expect(toggleTag(full, 'extra')).not.toContain('extra');
  });
});

describe('bodyRemaining', () => {
  it('counts down from the max and never goes negative', () => {
    expect(bodyRemaining('')).toBe(REVIEW_BODY_MAX);
    expect(bodyRemaining('hello')).toBe(REVIEW_BODY_MAX - 5);
    expect(bodyRemaining('x'.repeat(REVIEW_BODY_MAX + 50))).toBe(0);
  });
});

describe('canSubmitReview', () => {
  it('requires a 1–5 star rating', () => {
    expect(canSubmitReview(0)).toBe(false);
    expect(canSubmitReview(1)).toBe(true);
    expect(canSubmitReview(5)).toBe(true);
    expect(canSubmitReview(6)).toBe(false);
  });
});

describe('REVIEW_TAGS', () => {
  it('exposes the 6 design chips with stable codes', () => {
    expect(REVIEW_TAGS).toHaveLength(6);
    expect(REVIEW_TAGS.map((t) => t.code)).toContain('would_buy_again');
  });
});
