// modules/contract-farming/dto/update-contract-template.dto.ts · zod .strict() template active toggle.
import { z } from 'zod';
export const SetTemplateActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type SetTemplateActiveDto = z.infer<typeof SetTemplateActiveSchema>;
