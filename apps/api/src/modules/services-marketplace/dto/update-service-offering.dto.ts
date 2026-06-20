// modules/services-marketplace/dto/update-service-offering.dto.ts · zod .strict() offering patch.
import { z } from 'zod';
const minorStr = z.string().regex(/^\d{1,15}$/);
export const UpdateOfferingSchema = z.object({
  defaultTitle: z.string().min(1).max(250).optional(),
  description: z.string().max(5000).optional(),
  priceMinor: minorStr.optional(),
  capacityPerSlot: z.number().int().min(1).max(10000).optional(),
  serviceRadiusKm: z.number().int().min(0).max(1000).optional(),
  addressId: z.string().uuid().optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateOfferingDto = z.infer<typeof UpdateOfferingSchema>;
