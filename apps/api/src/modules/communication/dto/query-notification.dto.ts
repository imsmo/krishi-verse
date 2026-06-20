// modules/communication/dto/query-notification.dto.ts · zod .strict() — a user's own notification inbox (keyset).
import { z } from 'zod';
import { NOTIF_STATUSES } from '../domain/notification.state';
export const QueryNotificationsSchema = z.object({
  status: z.enum(NOTIF_STATUSES as unknown as [string, ...string[]]).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryNotificationsDto = z.infer<typeof QueryNotificationsSchema>;
