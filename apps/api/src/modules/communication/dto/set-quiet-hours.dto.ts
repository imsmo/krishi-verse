// modules/communication/dto/set-quiet-hours.dto.ts · zod .strict() — a user's quiet-hours window.
import { z } from 'zod';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;     // anchored, ReDoS-safe
export const SetQuietHoursSchema = z.object({
  starts: z.string().regex(HHMM),
  ends: z.string().regex(HHMM),
  timezone: z.string().min(1).max(40).default('Asia/Kolkata'),
}).strict();
export type SetQuietHoursDto = z.infer<typeof SetQuietHoursSchema>;
