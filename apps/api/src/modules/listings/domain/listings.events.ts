// modules/listings/domain/listings.events.ts
// Canonical event names + payload contracts published by this module.
// Mirror in packages/contracts/src/events/listings.events.ts (single source).
export const ListingEventType = {
  Created:      'listing.created',
  Published:    'listing.published',
  PriceChanged: 'listing.price_changed',
  StockChanged: 'listing.stock_changed',
  SoldOut:      'listing.sold_out',
  StatusChanged:'listing.status_changed',
  BoostStarted: 'listing.boost_started',
  GroupLotReady:'listing.group_lot_ready',
} as const;
export type ListingEventType = (typeof ListingEventType)[keyof typeof ListingEventType];

export interface ListingPublishedV1 {
  v: 1; listingId: string; tenantId: string; productId: string;
  categoryId: string; priceMinor: string; currencyCode: string;
  pincode?: string; regionId?: string; visibility: string; sellerUserId: string;
}
export interface ListingPriceChangedV1 {
  v: 1; listingId: string; tenantId: string; oldPriceMinor: string; newPriceMinor: string;
}
export interface ListingSoldOutV1 { v: 1; listingId: string; tenantId: string; }
