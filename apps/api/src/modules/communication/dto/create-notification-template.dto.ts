// modules/communication/dto/create-notification-template.dto.ts · zod .strict() — tenant template authoring.
import { z } from 'zod';
import { NOTIF_CHANNELS } from '../domain/communication.events';
export const UpsertTemplateSchema = z.object({
  eventCode: z.string().min(1).max(80),
  channel: z.enum(NOTIF_CHANNELS as unknown as [string, ...string[]]),
  languageCode: z.string().min(2).max(8),
  subject: z.string().max(250).nullish(),
  body: z.string().min(1).max(4000),
  providerTemplateRef: z.string().max(120).nullish(),
  isActive: z.boolean().default(true),
}).strict();
export type UpsertTemplateDto = z.infer<typeof UpsertTemplateSchema>;
