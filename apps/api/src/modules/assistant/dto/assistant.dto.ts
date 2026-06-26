// modules/assistant/dto/assistant.dto.ts · zod .strict() payload for a farmer assistant turn.
import { z } from 'zod';
import { ASSISTANT_LANGUAGES, MAX_MESSAGE_CHARS } from '../domain/guardrails';

export const AskAssistantSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_CHARS),
  languageCode: z.enum(ASSISTANT_LANGUAGES),
  sessionId: z.string().uuid().optional(),     // thread id (omit to start a new conversation)
}).strict();
export type AskAssistantDto = z.infer<typeof AskAssistantSchema>;
