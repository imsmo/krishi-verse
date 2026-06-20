// modules/ambassadors/dto/enroll-ambassador.dto.ts · zod .strict() — admin enrolls/updates an ambassador.
import { z } from 'zod';
const minor = z.string().regex(/^\d{1,15}$/);
export const EnrollAmbassadorSchema = z.object({
  userId: z.string().uuid(),
  clusterRegionIds: z.array(z.string().uuid()).max(3).default([]),
  tierId: z.string().uuid().nullish(),
  mentorAmbassadorId: z.string().uuid().nullish(),
  kioskEnabled: z.boolean().default(false),
  aepsEnabled: z.boolean().default(false),
  monthlyStipendMinor: minor.default('0'),
}).strict();
export type EnrollAmbassadorDto = z.infer<typeof EnrollAmbassadorSchema>;

export const UpdateAmbassadorSchema = z.object({
  clusterRegionIds: z.array(z.string().uuid()).max(3).optional(),
  tierId: z.string().uuid().nullish(),
  mentorAmbassadorId: z.string().uuid().nullish(),
  kioskEnabled: z.boolean().optional(),
  aepsEnabled: z.boolean().optional(),
  monthlyStipendMinor: minor.optional(),
  trainingCompleted: z.boolean().optional(),
}).strict();
export type UpdateAmbassadorDto = z.infer<typeof UpdateAmbassadorSchema>;
