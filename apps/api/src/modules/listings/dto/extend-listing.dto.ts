// modules/listings/dto/extend-listing.dto.ts · KV-BL-031 (screen 112 EXTEND cta).
// Push an active listing's expiry out by `days` WITHOUT resetting stats/views. Bounds mirror
// 03_API_CONTRACT_DELTA.md exactly: an integer 1..30 (re-validated by the domain entity too — defence in depth).
import { z } from 'zod';
export const ExtendListingSchema = z.object({
  days: z.number().int().min(1).max(30),
}).strict();
export type ExtendListingDto = z.infer<typeof ExtendListingSchema>;
