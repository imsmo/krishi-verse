// modules/communication/dto/query-notification-template.dto.ts · zod .strict() — list tenant/platform templates.
import { z } from 'zod';
import { NOTIF_CHANNELS } from '../domain/communication.events';
export const QueryTemplatesSchema = z.object({
  eventCode: z.string().max(80).optional(),
  channel: z.enum(NOTIF_CHANNELS as unknown as [string, ...string[]]).optional(),
  languageCode: z.string().max(8).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryTemplatesDto = z.infer<typeof QueryTemplatesSchema>;
