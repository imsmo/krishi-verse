// modules/labour/dto/create-attendance.dto.ts · zod .strict() worker clock-in payload (PRD §31.12).
// The device sends ONLY its raw GPS fix; the server resolves the booking's farm coordinates and computes
// the great-circle distance itself (domain/geo.ts) — the fence is NEVER trusted to the client.
import { z } from 'zod';
export const ClockInSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
}).strict();
export type ClockInDto = z.infer<typeof ClockInSchema>;
