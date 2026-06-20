// modules/communication/dto/initiate-masked-call.dto.ts · zod .strict() — initiate a privacy-proxy call.
import { z } from 'zod';
import { CONTEXT_TYPES } from '../domain/messaging.events';
export const InitiateMaskedCallSchema = z.object({
  calleeUserId: z.string().uuid(),
  contextType: z.enum(CONTEXT_TYPES as unknown as [string, ...string[]]).nullish(),
  contextId: z.string().uuid().nullish(),
}).strict();
export type InitiateMaskedCallDto = z.infer<typeof InitiateMaskedCallSchema>;
