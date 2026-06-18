// modules/tenancy/dto/update-plan.dto.ts · zod .strict() pause/resume payload.
import { z } from 'zod';
export const SetPlanActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type SetPlanActiveDto = z.infer<typeof SetPlanActiveSchema>;
