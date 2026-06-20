// modules/communication/dto/open-conversation.dto.ts · zod .strict() — open a conversation with participants.
import { z } from 'zod';
import { CONTEXT_TYPES } from '../domain/messaging.events';
export const OpenConversationSchema = z.object({
  contextType: z.enum(CONTEXT_TYPES as unknown as [string, ...string[]]),
  contextId: z.string().uuid().nullish(),
  participantUserIds: z.array(z.string().uuid()).min(1).max(50),   // bounded (anti-spam); caller is auto-added
}).strict();
export type OpenConversationDto = z.infer<typeof OpenConversationSchema>;
