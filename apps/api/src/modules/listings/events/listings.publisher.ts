// modules/listings/events/listings.publisher.ts
// The outbox is the ONLY publish mechanism (Law 4): services write events to the
// outbox table inside the business transaction; outbox-relay ships them to
// SQS/Kafka. This file is the routing contract the relay reads — domain event
// type → transport topic — plus the documented downstream consumers. No broker
// calls happen here.
import { ListingEventType } from '../domain/listings.events';

/** Relay routing: domain event type → stream/topic name. */
export const LISTING_EVENT_TOPICS: Record<string, string> = {
  [ListingEventType.Created]:       'catalogue.listings',
  [ListingEventType.Published]:     'catalogue.listings.search-index',
  [ListingEventType.StatusChanged]: 'catalogue.listings.search-index', // pause/reject/hide/expire/archive
  [ListingEventType.SoldOut]:       'catalogue.listings.search-index',
  [ListingEventType.StockChanged]:  'catalogue.listings.search-index',
  [ListingEventType.PriceChanged]:  'catalogue.listings.price-alerts',
  [ListingEventType.BoostStarted]:  'catalogue.listings.search-index',
  [ListingEventType.GroupLotReady]: 'catalogue.group-lots',
};

/** Downstream consumers per event (documentation + ownership traceability). */
export const LISTING_EVENT_CONSUMERS: Record<string, readonly string[]> = {
  [ListingEventType.Published]:    ['search-indexer', 'feed-builder', 'notifications'],
  [ListingEventType.PriceChanged]: ['saved-search-alerts', 'search-indexer'],
  [ListingEventType.StatusChanged]:['search-indexer'],
  [ListingEventType.SoldOut]:      ['search-indexer', 'recommendations'],
};
