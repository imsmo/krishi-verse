// modules/contract-farming/dto/create-input-advance.dto.ts · zod .strict() advance disbursement.
import { z } from 'zod';
const minorStr = z.string().regex(/^\d{1,15}$/, 'must be a positive integer (minor units)');
export const DisburseAdvanceSchema = z.object({
  growerId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  description: z.string().max(250).optional(),
  valueMinor: minorStr,
}).strict();
export type DisburseAdvanceDto = z.infer<typeof DisburseAdvanceSchema>;
