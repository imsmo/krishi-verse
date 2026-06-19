// modules/warehousing/dto/update-warehouse.dto.ts · zod .strict() warehouse patch.
import { z } from 'zod';
import { STORAGE_KINDS } from '../domain/warehousing.events';
const minorStr = z.string().regex(/^\d{1,15}$/);
export const UpdateWarehouseSchema = z.object({
  defaultName: z.string().min(1).max(200).optional(),
  operatorUserId: z.string().uuid().optional(),
  wdraRegNo: z.string().max(60).optional(),
  addressId: z.string().uuid().optional(),
  capacityMt: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional(),
  storageKinds: z.array(z.enum(STORAGE_KINDS as unknown as [string, ...string[]])).max(10).optional(),
  commoditiesAccepted: z.array(z.string().uuid()).max(100).optional(),
  ratePerQtlMonthMinor: minorStr.optional(),
  insurancePolicyRef: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateWarehouseDto = z.infer<typeof UpdateWarehouseSchema>;
