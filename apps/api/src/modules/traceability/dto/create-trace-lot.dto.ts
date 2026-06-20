// modules/traceability/dto/create-trace-lot.dto.ts · zod .strict() — open a traceable lot.
import { z } from 'zod';
export const CreateTraceLotSchema = z.object({
  listingId: z.string().uuid().nullish(),
  parcelId: z.string().uuid().nullish(),
  cropSeasonId: z.string().uuid().nullish(),
  declaredInputs: z.array(z.record(z.unknown())).max(100).default([]),
  certificateIds: z.array(z.string().uuid()).max(50).default([]),
}).strict();
export type CreateTraceLotDto = z.infer<typeof CreateTraceLotSchema>;
