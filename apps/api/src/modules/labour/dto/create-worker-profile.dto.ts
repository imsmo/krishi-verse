// modules/labour/dto/create-worker-profile.dto.ts · zod .strict() worker self-registration payload.
// Money fields are integer minor-unit STRINGS (bigint over the wire, Law 2). age_verified_18 is NOT
// settable here — it is verified out-of-band (KYC/admin), defaulting to false.
import { z } from 'zod';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a non-negative integer (minor units)');
export const RegisterWorkerSchema = z.object({
  villageRegionId: z.string().uuid().optional(),
  travelKm: z.number().int().min(0).max(2000).optional(),
  stayAwayOk: z.enum(['same_day', 'overnight', 'weekly', 'monthly']).optional(),
  minWageExpectationMinor: minorStr.optional(),
  autoAcceptAboveMinor: minorStr.optional(),
  hasSmartphone: z.boolean().optional(),
  emergencyContactName: z.string().min(1).max(150).optional(),
  emergencyContactPhone: z.string().min(5).max(20).optional(),
  eshramNo: z.string().min(1).max(20).optional(),
}).strict();
export type RegisterWorkerDto = z.infer<typeof RegisterWorkerSchema>;
