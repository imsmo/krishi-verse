// Unit tests for the PURE review-display helpers.
import { starGlyphs, hasReviewContent } from '../features/reviews/display';

describe('starGlyphs', () => {
  it('renders filled + empty stars to 5', () => {
    expect(starGlyphs(5)).toBe('★★★★★');
    expect(starGlyphs(4)).toBe('★★★★☆');
    expect(starGlyphs(1)).toBe('★☆☆☆☆');
  });
  it('clamps and rounds out-of-range / non-finite input', () => {
    expect(starGlyphs(0)).toBe('☆☆☆☆☆');
    expect(starGlyphs(9)).toBe('★★★★★');
    expect(starGlyphs(-3)).toBe('☆☆☆☆☆');
    expect(starGlyphs(3.6)).toBe('★★★★☆');
    expect(starGlyphs(NaN)).toBe('☆☆☆☆☆');
  });
});

describe('hasReviewContent', () => {
  it('true when body or seller response present', () => {
    expect(hasReviewContent({ body: 'great', sellerResponse: null })).toBe(true);
    expect(hasReviewContent({ body: null, sellerResponse: 'thanks' })).toBe(true);
  });
  it('false when both are empty/blank/null', () => {
    expect(hasReviewContent({ body: null, sellerResponse: null })).toBe(false);
    expect(hasReviewContent({ body: '   ', sellerResponse: '' })).toBe(false);
  });
});
