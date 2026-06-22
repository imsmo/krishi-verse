// modules/auctions/dto/create-auction-watcher.dto.ts · zod .strict() watch request. The auction is in
// the path and the user is the caller (resolved server-side) — so the body is empty (no mass-assignment).
import { z } from 'zod';
export const WatchAuctionSchema = z.object({}).strict();
export type WatchAuctionDto = z.infer<typeof WatchAuctionSchema>;
