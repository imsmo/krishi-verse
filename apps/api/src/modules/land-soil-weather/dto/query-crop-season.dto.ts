// modules/land-soil-weather/dto/query-crop-season.dto.ts · zod .strict() crop season list query (by parcel).
import { z } from 'zod';
import { CROP_STATUSES } from '../domain/crop-season.state';
export const QueryCropSeasonsSchema = z.object({
  parcelId: z.string().uuid(),
  status: z.enum(CROP_STATUSES as unknown as [string, ...string[]]).optional(),
}).strict();
export type QueryCropSeasonsDto = z.infer<typeof QueryCropSeasonsSchema>;
