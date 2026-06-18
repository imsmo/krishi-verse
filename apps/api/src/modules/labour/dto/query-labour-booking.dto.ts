// modules/labour/dto/query-labour-booking.dto.ts · zod .strict() booking list query (keyset pagination).
import { z } from 'zod';
import { BOOKING_STATUSES } from '../domain/labour-booking.state';
export const QueryBookingsSchema = z.object({
  box: z.enum(['mine', 'open', 'all']).default('mine'),  // mine=employer's own; open=marketplace; all=admin
  status: z.enum(BOOKING_STATUSES as unknown as [string, ...string[]]).optional(),
  taskSkillId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryBookingsDto = z.infer<typeof QueryBookingsSchema>;
