// modules/land-soil-weather/dto/weather-prefs.dto.ts · zod .strict() body for PUT weather prefs (P1-4).
import { z } from 'zod';
export const WeatherPrefsSchema = z.object({
  morningAdvisory: z.boolean(),
  weeklyOutlook: z.boolean(),
  severeOnly: z.boolean(),
}).strict();
export type WeatherPrefsDto = z.infer<typeof WeatherPrefsSchema>;
