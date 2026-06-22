// modules/logistics/dto/create-pickup-slot.dto.ts · a seller's weekly pickup window (zod .strict). weekday 0–6;
// start_time < end_time (HH:MM, 24h) — enforced in the domain. The slot is owned by the calling seller.
import { z } from 'zod';

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const CreatePickupSlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: Time,
  endTime: Time,
}).strict();
export type CreatePickupSlotDto = z.infer<typeof CreatePickupSlotSchema>;

export const UpdatePickupSlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  startTime: Time.optional(),
  endTime: Time.optional(),
}).strict().refine((d) => d.weekday !== undefined || d.startTime !== undefined || d.endTime !== undefined, { message: 'at least one field is required' });
export type UpdatePickupSlotDto = z.infer<typeof UpdatePickupSlotSchema>;

export const QueryPickupSlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  activeOnly: z.coerce.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type QueryPickupSlotDto = z.infer<typeof QueryPickupSlotSchema>;
