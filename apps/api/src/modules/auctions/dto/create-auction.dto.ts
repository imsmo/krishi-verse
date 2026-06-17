// modules/auctions/dto/create-auction.dto.ts · zod .strict() (rejects unknown keys → no mass-assignment).
import { z } from 'zod';

const minor = z.string().regex(/^[1-9]\d{0,15}$/, 'must be a positive integer string of minor units');
const minor0 = z.string().regex(/^\d{1,16}$/, 'must be a non-negative integer string of minor units');

export const CreateAuctionSchema = z.object({
  listingId: z.string().uuid(),
  kind: z.enum(['english_open', 'sealed']).default('english_open'),   // reverse/dutch not supported yet
  startPriceMinor: minor,
  reservePriceMinor: minor.optional(),
  minIncrementMinor: minor.optional(),
  emdMinor: minor0.optional(),
  emdPctBps: z.coerce.number().int().min(0).max(10000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  autoExtendSecs: z.coerce.number().int().min(0).max(3600).optional(),
  extendTriggerSecs: z.coerce.number().int().min(0).max(3600).optional(),
  minBidders: z.coerce.number().int().min(0).max(100000).optional(),
  requiresSellerApproval: z.boolean().optional(),
}).strict();
export type CreateAuctionDto = z.infer<typeof CreateAuctionSchema>;
