// modules/auctions/dto/update-auction.dto.ts · zod .strict() seller edit of a SCHEDULED auction (before
// it opens / any bids). Only the safe-to-change knobs; identity (listing/kind/tenant), status, and the
// winner are NEVER writable here (no mass-assignment). At least one field must be present.
import { z } from 'zod';

const minor = z.string().regex(/^[1-9]\d{0,15}$/, 'must be a positive integer string of minor units');

export const UpdateAuctionSchema = z.object({
  reservePriceMinor: minor.nullable().optional(),     // null clears the reserve
  minIncrementMinor: minor.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'no fields to update' });
export type UpdateAuctionDto = z.infer<typeof UpdateAuctionSchema>;
