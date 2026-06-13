// modules/listings/events/handlers/auction-settled.handler.ts
// Reacts to auctions.auction_settled: the winning bid consumes the auction listing's
// quantity and moves the listing to sold/closed. Idempotent at the consumer layer.
import { Injectable, Logger } from '@nestjs/common';
import { ListingService } from '../../services/listing.service';

interface AuctionSettledV1 { v: 1; tenantId: string; listingId: string; wonQuantity: number; auctionId: string; }

@Injectable()
export class AuctionSettledHandler {
  private readonly log = new Logger(AuctionSettledHandler.name);
  constructor(private readonly listings: ListingService) {}
  async handle(evt: AuctionSettledV1): Promise<void> {
    await this.listings.reduceStock(evt.tenantId, evt.listingId, evt.wonQuantity);
    this.log.log(`auction ${evt.auctionId} settled → listing ${evt.listingId} -${evt.wonQuantity}`);
  }
}
