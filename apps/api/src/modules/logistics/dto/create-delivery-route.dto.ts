// modules/logistics/dto/create-delivery-route.dto.ts · create/update a Village Run route (zod .strict).
import { z } from 'zod';

const Weekday = z.coerce.number().int().min(0).max(6);
const RegionIds = z.array(z.string().uuid()).max(2000);

export const CreateDeliveryRouteSchema = z.object({
  defaultName: z.string().trim().min(1).max(150),
  runWeekday: Weekday.nullable().optional(),
  villageRegionIds: RegionIds.default([]),
  vehicleId: z.string().uuid().nullable().optional(),
  consolidationUserId: z.string().uuid().nullable().optional(),
}).strict();
export type CreateDeliveryRouteDto = z.infer<typeof CreateDeliveryRouteSchema>;

export const UpdateDeliveryRouteSchema = z.object({
  defaultName: z.string().trim().min(1).max(150).optional(),
  runWeekday: Weekday.nullable().optional(),
  villageRegionIds: RegionIds.optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  consolidationUserId: z.string().uuid().nullable().optional(),
}).strict().refine((d) => Object.keys(d).length > 0, { message: 'at least one field is required' });
export type UpdateDeliveryRouteDto = z.infer<typeof UpdateDeliveryRouteSchema>;
