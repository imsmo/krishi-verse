// modules/livestock/dto/create-animal.dto.ts · zod .strict() animal-registration payload (farmer-owned).
// owner is the CALLER (never client-supplied). pashu_aadhaar is INAPH 12-digit (validated, optional).
import { z } from 'zod';
const decimalStr = (max: number) => z.string().regex(new RegExp(`^\\d{1,${max}}(\\.\\d{1,2})?$`), 'invalid decimal');
export const CreateAnimalSchema = z.object({
  speciesId: z.string().uuid(),
  breedId: z.string().uuid().optional(),
  pashuAadhaar: z.string().regex(/^\d{12}$/, 'Pashu Aadhaar must be 12 digits').optional(),
  name: z.string().min(1).max(100).optional(),
  sex: z.enum(['male', 'female']).optional(),
  dobEstimated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parity: z.number().int().min(0).max(30).optional(),
  lactationStage: z.enum(['dry', 'early', 'mid', 'late']).optional(),
  currentYieldLpd: decimalStr(4).optional(),
  pregnancyStatus: z.enum(['open', 'pregnant', 'unknown']).optional(),
  bodyConditionScore: z.string().regex(/^[1-5](\.\d)?$/).optional(),
  acquiredVia: z.enum(['born', 'purchased', 'transferred']).optional(),
}).strict();
export type CreateAnimalDto = z.infer<typeof CreateAnimalSchema>;

export const UpdateAnimalSchema = z.object({
  breedId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  sex: z.enum(['male', 'female']).optional(),
  dobEstimated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parity: z.number().int().min(0).max(30).optional(),
  lactationStage: z.enum(['dry', 'early', 'mid', 'late']).optional(),
  currentYieldLpd: decimalStr(4).optional(),
  pregnancyStatus: z.enum(['open', 'pregnant', 'unknown']).optional(),
  bodyConditionScore: z.string().regex(/^[1-5](\.\d)?$/).optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateAnimalDto = z.infer<typeof UpdateAnimalSchema>;

export const RetireAnimalSchema = z.object({ reason: z.enum(['sold', 'deceased', 'lost']) }).strict();
export type RetireAnimalDto = z.infer<typeof RetireAnimalSchema>;
