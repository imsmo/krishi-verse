// modules/education/dto/query-crop-calendar.dto.ts · zod .strict() query for browsing crop-agronomy calendars (P1-5).
import { z } from 'zod';
export const QueryCropCalendarSchema = z.object({
  crop: z.string().trim().min(1).max(120).optional(),
  season: z.enum(['kharif', 'rabi', 'zaid', 'perennial']).optional(),
  regionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();
export type QueryCropCalendarDto = z.infer<typeof QueryCropCalendarSchema>;
