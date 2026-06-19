// modules/contract-farming/dto/create-contract-grower.dto.ts · zod .strict() grower enrolment.
import { z } from 'zod';
export const EnrolGrowerSchema = z.object({
  farmerUserId: z.string().uuid(),
  landParcelId: z.string().uuid().optional(),
  committedQuantity: z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'quantity, up to 3 decimals'),
}).strict();
export type EnrolGrowerDto = z.infer<typeof EnrolGrowerSchema>;
