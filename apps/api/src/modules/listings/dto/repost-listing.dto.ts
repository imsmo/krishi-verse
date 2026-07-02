// modules/listings/dto/repost-listing.dto.ts
// Repost an expired/sold-out/hidden/paused listing back to 'published' for a fresh window. Optionally update the
// price in the same op (bigint minor string — Law 2). durationDays bounds the new live window (server re-validates).
import { z } from 'zod';
export const RepostListingSchema = z.object({
  newPriceMinor: z.string().regex(/^[1-9]\d{0,15}$/).optional(),
  durationDays: z.number().int().min(1).max(60).optional(),
}).strict();
export type RepostListingDto = z.infer<typeof RepostListingSchema>;
