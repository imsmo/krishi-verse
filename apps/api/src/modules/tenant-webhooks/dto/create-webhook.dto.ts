// modules/tenant-webhooks/dto/create-webhook.dto.ts · zod .strict() DTOs. The URL is https-only + length-bounded
// (SSRF re-checked in the domain); eventTypes are validated against the allow-list in the service. Anchored regex.
import { z } from 'zod';

const EVENT = z.string().regex(/^[a-z][a-z0-9_.]{1,59}$/);

export const CreateWebhookSchema = z.object({
  url: z.string().url().max(500),
  eventTypes: z.array(EVENT).min(1).max(50),
}).strict();
export type CreateWebhookDto = z.infer<typeof CreateWebhookSchema>;

export const UpdateWebhookSchema = z.object({
  eventTypes: z.array(EVENT).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((v) => v.eventTypes !== undefined || v.isActive !== undefined, { message: 'nothing to update' });
export type UpdateWebhookDto = z.infer<typeof UpdateWebhookSchema>;
