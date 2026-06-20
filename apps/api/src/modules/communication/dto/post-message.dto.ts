// modules/communication/dto/post-message.dto.ts · zod .strict() — post a message (body | voice | attachment).
import { z } from 'zod';
export const PostMessageSchema = z.object({
  body: z.string().min(1).max(4000).nullish(),
  voiceMediaId: z.string().uuid().nullish(),
  attachmentMediaId: z.string().uuid().nullish(),
}).strict().refine((v) => !!(v.body || v.voiceMediaId || v.attachmentMediaId), { message: 'message needs body, voice, or an attachment' });
export type PostMessageDto = z.infer<typeof PostMessageSchema>;
