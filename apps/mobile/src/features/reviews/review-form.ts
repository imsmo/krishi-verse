// apps/mobile/src/features/reviews/review-form.ts · PURE form logic for the post-order review (screen 24).
// No React / no SDK — just the rating-label map, the "what went well" tag catalog, and small validators the
// screen and its unit tests share. The tag CODES are stable server-bound values (sent in CreateReview.tags); the
// LABELS are i18n keys (UI chrome). Quality words are derived from the user's OWN star input, never fabricated data.

/** The 1–5 star → quality-word i18n suffix the design shows ("4.0 — Very Good"). 0 = nothing chosen yet. */
export function ratingLabelKey(stars: number): '' | 'poor' | 'fair' | 'good' | 'very_good' | 'excellent' {
  switch (stars) {
    case 1: return 'poor';
    case 2: return 'fair';
    case 3: return 'good';
    case 4: return 'very_good';
    case 5: return 'excellent';
    default: return '';
  }
}

/** The numeric rating the design prints next to the word (e.g. "4.0"). Derived from the chosen stars, locale-free
 * (one decimal) — it's the user's own selection, not a server value. */
export function ratingNumber(stars: number): string {
  return stars >= 1 ? stars.toFixed(1) : '0.0';
}

/** The "What went well?" chips. `code` is sent to the server (CreateReview.tags, ≤40 chars each); `labelKey` is
 * the hi/en/gu i18n key. Order matches the design. */
export const REVIEW_TAGS: ReadonlyArray<{ code: string; labelKey: string }> = [
  { code: 'quality_good', labelKey: 'review.tag.quality_good' },
  { code: 'on_time', labelKey: 'review.tag.on_time' },
  { code: 'fair_price', labelKey: 'review.tag.fair_price' },
  { code: 'well_packaged', labelKey: 'review.tag.well_packaged' },
  { code: 'friendly_seller', labelKey: 'review.tag.friendly_seller' },
  { code: 'would_buy_again', labelKey: 'review.tag.would_buy_again' },
] as const;

/** Max review body length the design's counter ("87 / 500") implies. The server allows more; we cap to the design. */
export const REVIEW_BODY_MAX = 500;
/** Server cap on number of tags (mirrors CreateReview DTO `.max(10)`); the design uses 6. */
export const REVIEW_TAGS_MAX = 10;

/** Toggle a tag code in/out of the selected set (pure; bounded to REVIEW_TAGS_MAX — extra taps are ignored). */
export function toggleTag(selected: readonly string[], code: string): string[] {
  if (selected.includes(code)) return selected.filter((c) => c !== code);
  if (selected.length >= REVIEW_TAGS_MAX) return [...selected];
  return [...selected, code];
}

/** Remaining characters for the body counter (never negative). */
export function bodyRemaining(body: string): number {
  return Math.max(0, REVIEW_BODY_MAX - [...body].length);
}

/** A review can be submitted once a 1–5 star rating is chosen (the server re-validates eligibility). */
export function canSubmitReview(stars: number): boolean {
  return Number.isInteger(stars) && stars >= 1 && stars <= 5;
}
