// modules/memberships/dto/update-membership-tier.dto.ts · zod .strict() pause/resume payload.
import { z } from 'zod';
export const SetTierActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type SetTierActiveDto = z.infer<typeof SetTierActiveSchema>;
