// modules/land-soil-weather/dto/query-land-parcel.dto.ts · zod .strict() parcel list query (keyset).
import { z } from 'zod';
export const QueryParcelsSchema = z.object({
  box: z.enum(['mine', 'all']).default('mine'),
  regionId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryParcelsDto = z.infer<typeof QueryParcelsSchema>;
