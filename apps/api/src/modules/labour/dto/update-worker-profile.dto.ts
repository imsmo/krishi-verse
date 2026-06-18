// modules/labour/dto/update-worker-profile.dto.ts · zod .strict() worker preference patch (partial).
import { z } from 'zod';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a non-negative integer (minor units)');
export const UpdateWorkerSchema = z.object({
  villageRegionId: z.string().uuid().optional(),
  travelKm: z.number().int().min(0).max(2000).optional(),
  stayAwayOk: z.enum(['same_day', 'overnight', 'weekly', 'monthly']).optional(),
  minWageExpectationMinor: minorStr.optional(),
  autoAcceptAboveMinor: minorStr.optional(),
  hasSmartphone: z.boolean().optional(),
  emergencyContactName: z.string().min(1).max(150).optional(),
  emergencyContactPhone: z.string().min(5).max(20).optional(),
  eshramNo: z.string().min(1).max(20).optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateWorkerDto = z.infer<typeof UpdateWorkerSchema>;
