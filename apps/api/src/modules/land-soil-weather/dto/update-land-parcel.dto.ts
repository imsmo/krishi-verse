// modules/land-soil-weather/dto/update-land-parcel.dto.ts · zod .strict() parcel patch.
import { z } from 'zod';
export const UpdateParcelSchema = z.object({
  regionId: z.string().uuid().optional(),
  surveyNo: z.string().max(60).optional(),
  bhulekhRef: z.string().max(120).optional(),
  irrigationTypeCode: z.string().min(1).max(40).optional(),
  boundaryGeojson: z.record(z.unknown()).optional(),
  isTenantFarmed: z.boolean().optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'at least one field required' });
export type UpdateParcelDto = z.infer<typeof UpdateParcelSchema>;
