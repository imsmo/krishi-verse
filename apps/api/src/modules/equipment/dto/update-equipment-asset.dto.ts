// modules/equipment/dto/update-equipment-asset.dto.ts · zod .strict() asset patch + status set.
import { z } from 'zod';
import { ASSET_STATUSES } from '../domain/equipment.events';
export const UpdateAssetSchema = z.object({
  productId: z.string().uuid().optional(),
  regNo: z.string().min(1).max(20).optional(),
  yearOfMfg: z.number().int().min(1950).max(2100).optional(),
  engineHours: z.string().regex(/^\d{1,9}(\.\d)?$/).optional(),
  hpRating: z.number().int().min(1).max(2000).optional(),
  baseAddressId: z.string().uuid().optional(),
  serviceRadiusKm: z.number().int().min(0).max(1000).optional(),
  gpsDeviceRef: z.string().max(100).optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateAssetDto = z.infer<typeof UpdateAssetSchema>;

export const SetAssetStatusSchema = z.object({ status: z.enum(ASSET_STATUSES as unknown as [string, ...string[]]) }).strict();
export type SetAssetStatusDto = z.infer<typeof SetAssetStatusSchema>;
