// modules/services-marketplace/dto/create-service-offering.dto.ts · zod .strict() offering create + update.
import { z } from 'zod';
import { PRICING_MODELS } from '../domain/services-marketplace.events';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a positive integer (minor units)');
export const CreateOfferingSchema = z.object({
  categoryId: z.string().uuid(),
  defaultTitle: z.string().min(1).max(250),
  description: z.string().max(5000).optional(),
  pricingModel: z.enum(PRICING_MODELS as unknown as [string, ...string[]]),
  priceMinor: minorStr,
  capacityPerSlot: z.number().int().min(1).max(10000).optional(),
  serviceRadiusKm: z.number().int().min(0).max(1000).optional(),
  addressId: z.string().uuid().optional(),
}).strict();
export type CreateOfferingDto = z.infer<typeof CreateOfferingSchema>;
