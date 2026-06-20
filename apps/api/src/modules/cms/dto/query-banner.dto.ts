// modules/cms/dto/query-banner.dto.ts · zod .strict() — list banners (live browse or admin).
import { z } from 'zod';
export const QueryBannersSchema = z.object({
  box: z.enum(['live', 'all']).default('live'),   // live = active + within window; all = admin
  placement: z.string().max(40).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryBannersDto = z.infer<typeof QueryBannersSchema>;
