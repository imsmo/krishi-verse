// modules/ambassadors/dto/query-earning.dto.ts · zod .strict() — list an ambassador's earnings (keyset).
import { z } from 'zod';
export const QueryEarningsSchema = z.object({
  unpaidOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryEarningsDto = z.infer<typeof QueryEarningsSchema>;
