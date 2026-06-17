// modules/auctions/domain/auctions.events.ts · integration events (via outbox, Law 4).
export const AuctionEventType = {
  Created: 'auctions.auction_created',
  Opened: 'auctions.auction_opened',
  BidPlaced: 'auctions.bid_placed',
  Extended: 'auctions.auction_extended',
  Ended: 'auctions.auction_ended',
  Won: 'auctions.auction_won',          // winner determined → orders may create the order (downstream)
  FailedReserve: 'auctions.auction_failed_reserve',
  Cancelled: 'auctions.auction_cancelled',
} as const;
export type AuctionEventType = typeof AuctionEventType[keyof typeof AuctionEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };
