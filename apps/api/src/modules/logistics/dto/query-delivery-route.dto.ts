// modules/logistics/dto/query-delivery-route.dto.ts · list Village Run routes (optionally by run weekday), keyset.
import { z } from 'zod';
export const QueryDeliveryRouteSchema = z.object({
  runWeekday: z.coerce.number().int().min(0).max(6).optional(),
  activeOnly: z.coerce.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryDeliveryRouteDto = z.infer<typeof QueryDeliveryRouteSchema>;
