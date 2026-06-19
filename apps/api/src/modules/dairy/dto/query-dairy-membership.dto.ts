// modules/dairy/dto/query-dairy-membership.dto.ts · zod .strict() membership list query (keyset).
import { z } from 'zod';
export const QueryMembershipsSchema = z.object({
  box: z.enum(['mine', 'mcc', 'all']).default('mine'),   // mine=farmer's own; mcc=by mccId (operator); all=admin
  mccId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryMembershipsDto = z.infer<typeof QueryMembershipsSchema>;
