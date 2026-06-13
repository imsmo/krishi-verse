// internal only — price history is written by the service, never via API. Schema kept for typing.
import { z } from 'zod';
export const CreatePriceHistorySchema = z.object({
  listingId: z.string().uuid(), oldPriceMinor: z.string().nullable(), newPriceMinor: z.string(),
}).strict();
export type CreatePriceHistoryDto = z.infer<typeof CreatePriceHistorySchema>;
