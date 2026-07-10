// modules/communication/dto/query-conversation.dto.ts · zod .strict() — list the caller's conversations (keyset).
import { z } from 'zod';
import { CONTEXT_TYPES } from '../domain/messaging.events';
export const QueryConversationsSchema = z.object({
  contextType: z.enum(CONTEXT_TYPES as unknown as [string, ...string[]]).optional(),
  // KV-BL-031: filter to ONE context row (e.g. a single listing's inquiry threads). Requires contextType to be
  // meaningful (a bare contextId across all context types would cross-match unrelated aggregates by coincidence
  // of uuid), but we don't hard-require the pair here — the repository only applies contextId when both are
  // present, same permissive style as the rest of this schema.
  contextId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // contract-gap P0-1: false ⇒ the inbox (default), true ⇒ the per-participant archive.
  archived: z.coerce.boolean().optional().default(false),
}).strict();
export type QueryConversationsDto = z.infer<typeof QueryConversationsSchema>;
