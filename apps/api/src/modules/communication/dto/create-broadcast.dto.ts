// modules/communication/dto/create-broadcast.dto.ts · zod .strict() tenant broadcast send + list query.
import { z } from 'zod';
export const CreateBroadcastSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  audienceRoleCode: z.string().min(2).max(60).optional(),   // omit = all active tenant members
}).strict();
export type CreateBroadcastDto = z.infer<typeof CreateBroadcastSchema>;

export const QueryBroadcastsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryBroadcastsDto = z.infer<typeof QueryBroadcastsSchema>;
