// modules/communication/dto/query-conversation.dto.ts · zod .strict() — list the caller's conversations (keyset).
import { z } from 'zod';
import { CONTEXT_TYPES } from '../domain/messaging.events';
export const QueryConversationsSchema = z.object({
  contextType: z.enum(CONTEXT_TYPES as unknown as [string, ...string[]]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // contract-gap P0-1: false ⇒ the inbox (default), true ⇒ the per-participant archive.
  archived: z.coerce.boolean().optional().default(false),
}).strict();
export type QueryConversationsDto = z.infer<typeof QueryConversationsSchema>;
