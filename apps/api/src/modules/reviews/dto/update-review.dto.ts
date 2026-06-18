// modules/reviews/dto/update-review.dto.ts · zod .strict() payloads for edit / seller-response / moderation.
import { z } from 'zod';
const star = z.number().int().min(1).max(5);

export const EditReviewSchema = z.object({
  stars: star.optional(),
  subRatings: z.record(z.string().regex(/^[a-z_]{1,30}$/), star).optional(),
  body: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'nothing to update' });
export type EditReviewDto = z.infer<typeof EditReviewSchema>;

export const SellerResponseSchema = z.object({ response: z.string().min(1).max(4000) }).strict();
export type SellerResponseDto = z.infer<typeof SellerResponseSchema>;

export const ModerateReviewSchema = z.object({ action: z.enum(['hide', 'restore', 'flag', 'remove']), reason: z.string().max(500).optional() }).strict();
export type ModerateReviewDto = z.infer<typeof ModerateReviewSchema>;
