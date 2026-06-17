// modules/auctions/auctions.module.ts
// English/sealed auctions with EMD holds + anti-snipe auto-extend. Reads listing price/seller via
// ListingService (cross-module public API, Law 11). EMD moves only via the wallet boundary. Money
// never leaves to a seller here — the winner is announced via the outbox (auctions.auction_won);
// order creation is downstream. Gated by the `auctions` feature flag.
import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { AuctionsController } from './controllers/v1/auctions.controller';
import { BidsController } from './controllers/v1/bids.controller';
import { AuctionService } from './services/auction.service';
import { BidService } from './services/bid.service';
import { AuctionRepository } from './repositories/auction.repository';
import { BidRepository } from './repositories/bid.repository';
import { AuctionLiveReadModel } from './read-models/auction-live.read-model';

// The open/close worker jobs (jobs/*.job.ts) are instantiated by apps/worker with a privileged
// kv_relay Pool — not DI providers (they take a Pool, not a token), mirroring the payout/image jobs.
@Module({
  imports: [ListingsModule],
  controllers: [AuctionsController, BidsController],
  providers: [AuctionService, BidService, AuctionRepository, BidRepository, AuctionLiveReadModel],
  exports: [AuctionService],
})
export class AuctionsModule {}
