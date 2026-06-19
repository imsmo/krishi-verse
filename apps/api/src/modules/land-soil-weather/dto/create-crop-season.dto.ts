// modules/land-soil-weather/dto/create-crop-season.dto.ts · zod .strict() crop season + lifecycle payloads.
// yields are decimal strings (parsed to scaled integers ×1000; no float).
import { z } from 'zod';
import { CROP_SEASONS } from '../domain/land-soil-weather.events';
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const yieldStr = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, 'yield, up to 3 decimals');
export const PlanCropSeasonSchema = z.object({
  parcelId: z.string().uuid(),
  productId: z.string().uuid(),
  season: z.enum(CROP_SEASONS as unknown as [string, ...string[]]),
  year: z.number().int().min(2000).max(2100),
  sownOn: dateStr.optional(),
  expectedHarvest: dateStr.optional(),
  expectedYield: yieldStr.optional(),
}).strict();
export type PlanCropSeasonDto = z.infer<typeof PlanCropSeasonSchema>;

export const SowCropSeasonSchema = z.object({ sownOn: dateStr }).strict();
export type SowCropSeasonDto = z.infer<typeof SowCropSeasonSchema>;
export const HarvestCropSeasonSchema = z.object({ actualYield: yieldStr.optional() }).strict();
export type HarvestCropSeasonDto = z.infer<typeof HarvestCropSeasonSchema>;
