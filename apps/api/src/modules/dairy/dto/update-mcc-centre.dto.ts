// modules/dairy/dto/update-mcc-centre.dto.ts · zod .strict() MCC active toggle.
import { z } from 'zod';
export const SetMccActiveSchema = z.object({ isActive: z.boolean() }).strict();
export type SetMccActiveDto = z.infer<typeof SetMccActiveSchema>;
