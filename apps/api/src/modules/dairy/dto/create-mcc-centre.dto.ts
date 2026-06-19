// modules/dairy/dto/create-mcc-centre.dto.ts · zod .strict() MCC create payload (lat/lng as decimal strings).
import { z } from 'zod';
const latStr = z.string().regex(/^-?\d{1,3}(\.\d{1,6})?$/);
export const CreateMccSchema = z.object({
  code: z.string().min(1).max(40),
  defaultName: z.string().min(1).max(150),
  regionId: z.string().uuid().optional(),
  lat: latStr.optional(),
  lng: latStr.optional(),
  operatorUserId: z.string().uuid().optional(),
  capacityLitresShift: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).optional(),
  analyzerModel: z.string().max(100).optional(),
  analyzerSerial: z.string().max(100).optional(),
}).strict();
export type CreateMccDto = z.infer<typeof CreateMccSchema>;
