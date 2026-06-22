// modules/logistics/dto/query-vehicle.dto.ts · list vehicles (optionally by partner), keyset pagination.
import { z } from 'zod';
export const QueryVehicleSchema = z.object({
  partnerId: z.string().uuid().optional(),
  activeOnly: z.coerce.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryVehicleDto = z.infer<typeof QueryVehicleSchema>;
