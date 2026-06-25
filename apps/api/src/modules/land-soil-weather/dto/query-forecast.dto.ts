// modules/land-soil-weather/dto/query-forecast.dto.ts · zod .strict() geocoded forecast query (P0-12).
// lat/lng are coarse coordinates (not PII). regionId is OPTIONAL — when present it is the degrade target
// (provider down ⇒ return that region's real advisories instead of fabricating a forecast).
import { z } from 'zod';
export const QueryForecastSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  days: z.coerce.number().int().min(1).max(16).optional(),
  regionId: z.string().uuid().optional(),
}).strict();
export type QueryForecastDto = z.infer<typeof QueryForecastSchema>;
