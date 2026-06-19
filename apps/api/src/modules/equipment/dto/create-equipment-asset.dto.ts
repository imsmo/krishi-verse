// modules/equipment/dto/create-equipment-asset.dto.ts · zod .strict() asset listing + update payloads.
import { z } from 'zod';
export const CreateAssetSchema = z.object({
  categoryId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  regNo: z.string().min(1).max(20).optional(),
  yearOfMfg: z.number().int().min(1950).max(2100).optional(),
  engineHours: z.string().regex(/^\d{1,9}(\.\d)?$/).optional(),
  hpRating: z.number().int().min(1).max(2000).optional(),
  baseAddressId: z.string().uuid().optional(),
  serviceRadiusKm: z.number().int().min(0).max(1000).optional(),
  gpsDeviceRef: z.string().max(100).optional(),
}).strict();
export type CreateAssetDto = z.infer<typeof CreateAssetSchema>;
