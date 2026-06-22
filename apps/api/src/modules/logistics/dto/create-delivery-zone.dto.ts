// modules/logistics/dto/create-delivery-zone.dto.ts · create/update a tenant serviceability zone (zod .strict).
// pincodes/region_ids bounded here AND in the domain (defence in depth). charge_definition_id is optional.
import { z } from 'zod';

const Pincode = z.string().regex(/^[1-9][0-9]{5}$/);
const Pincodes = z.array(Pincode).max(5000);
const RegionIds = z.array(z.string().uuid()).max(2000);

export const CreateDeliveryZoneSchema = z.object({
  defaultName: z.string().trim().min(1).max(120),
  pincodes: Pincodes.default([]),
  regionIds: RegionIds.default([]),
  chargeDefinitionId: z.string().uuid().nullable().optional(),
}).strict();
export type CreateDeliveryZoneDto = z.infer<typeof CreateDeliveryZoneSchema>;

export const UpdateDeliveryZoneSchema = z.object({
  defaultName: z.string().trim().min(1).max(120).optional(),
  pincodes: Pincodes.optional(),
  regionIds: RegionIds.optional(),
  chargeDefinitionId: z.string().uuid().nullable().optional(),
}).strict().refine((d) => Object.keys(d).length > 0, { message: 'at least one field is required' });
export type UpdateDeliveryZoneDto = z.infer<typeof UpdateDeliveryZoneSchema>;

export const ZoneSetActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type ZoneSetActiveDto = z.infer<typeof ZoneSetActiveSchema>;
