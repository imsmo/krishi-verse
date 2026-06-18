// modules/reviews/dto/query-review.dto.ts · list/filter query params (cursor pagination, never OFFSET).
import { z } from 'zod';
import { ReviewTargetType } from '../domain/reviews.events';

// Public list of a target's reviews; or the caller's own authored reviews (box=mine).
export const REVIEW_BOXES = ['target', 'mine'] as const;
export type ReviewBox = (typeof REVIEW_BOXES)[number];

export const QueryReviewsSchema = z.object({
  box: z.enum(REVIEW_BOXES).default('target'),
  targetType: z.enum(['seller', 'buyer'] as [ReviewTargetType, ReviewTargetType]).optional(),
  targetId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type QueryReviewsDto = z.infer<typeof QueryReviewsSchema>;

export const ReviewSummaryQuerySchema = z.object({
  targetType: z.enum(['seller', 'buyer'] as [ReviewTargetType, ReviewTargetType]),
  targetId: z.string().uuid(),
}).strict();
export type ReviewSummaryQueryDto = z.infer<typeof ReviewSummaryQuerySchema>;
