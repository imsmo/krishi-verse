// modules/education/dto/schedule-live.dto.ts · zod .strict() — schedule a live session + browse.
import { z } from 'zod';
export const ScheduleLiveSchema = z.object({
  channelId: z.string().uuid(),
  title: z.string().min(1).max(250),
  topicId: z.string().uuid().nullish(),
  scheduledAt: z.string().datetime(),
}).strict();
export type ScheduleLiveDto = z.infer<typeof ScheduleLiveSchema>;

export const QueryLiveSchema = z.object({
  box: z.enum(['upcoming', 'mine', 'all']).default('upcoming'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryLiveDto = z.infer<typeof QueryLiveSchema>;
