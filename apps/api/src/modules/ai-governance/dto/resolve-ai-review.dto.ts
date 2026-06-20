// modules/ai-governance/dto/resolve-ai-review.dto.ts · zod .strict() — a reviewer's decision on a queue item.
import { z } from 'zod';
export const ResolveReviewSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().max(1000).nullish(),
}).strict();
export type ResolveReviewDto = z.infer<typeof ResolveReviewSchema>;
