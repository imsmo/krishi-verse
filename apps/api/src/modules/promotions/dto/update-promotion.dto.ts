// modules/promotions/dto/update-promotion.dto.ts · zod .strict() pause/resume payload.
import { z } from 'zod';
export const SetPromotionActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type SetPromotionActiveDto = z.infer<typeof SetPromotionActiveSchema>;
