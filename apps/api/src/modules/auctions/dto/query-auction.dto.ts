// modules/auctions/dto/query-auction.dto.ts · zod .strict() auction list params. Optional status filter
// (the auction_status enum) + keyset cursor (never OFFSET) + bounded limit. Reads on the replica (CQRS).
import { z } from 'zod';
import { AUCTION_STATUSES } from '../domain/auction.state';
export const QueryAuctionsSchema = z.object({
  status: z.enum(AUCTION_STATUSES).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type QueryAuctionsDto = z.infer<typeof QueryAuctionsSchema>;
