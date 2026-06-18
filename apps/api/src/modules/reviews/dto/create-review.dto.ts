// modules/reviews/dto/create-review.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
// A review is bound to a completed order; the target (seller↔buyer) is resolved server-side from the
// verified-purchase eligibility — the client never supplies target_id (anti-IDOR).
import { z } from 'zod';

const star = z.number().int().min(1).max(5);

export const CreateReviewSchema = z.object({
  orderId: z.string().uuid(),
  stars: star,
  subRatings: z.record(z.string().regex(/^[a-z_]{1,30}$/), star).optional(),
  body: z.string().max(4000).optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
}).strict();
export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;
