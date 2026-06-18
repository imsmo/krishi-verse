// modules/disputes/dto/create-dispute-message.dto.ts · zod .strict() threaded-evidence message body.
import { z } from 'zod';
export const CreateDisputeMessageSchema = z.object({ body: z.string().min(1).max(4000) }).strict();
export type CreateDisputeMessageDto = z.infer<typeof CreateDisputeMessageSchema>;
