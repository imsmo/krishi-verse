// modules/ambassadors/dto/query-ambassador.dto.ts · zod .strict() — list ambassadors (admin; keyset).
import { z } from 'zod';
export const QueryAmbassadorsSchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryAmbassadorsDto = z.infer<typeof QueryAmbassadorsSchema>;
