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
  Outbid: 'auctions.bidder_outbid',     // a higher bid arrived → notify the previous high bidder
  WatchStarted: 'auctions.watch_started',
  Updated: 'auctions.auction_updated',  // seller edited a scheduled auction's terms
  EmdReleased: 'auctions.emd_released', // a (losing) bidder's EMD hold was returned
} as const;
export type AuctionEventType = typeof AuctionEventType[keyof typeof AuctionEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };
