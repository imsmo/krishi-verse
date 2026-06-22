// modules/auctions/auctions.module.ts
// English/sealed auctions with EMD holds + anti-snipe auto-extend. Reads listing price/seller via
// ListingService (cross-module public API, Law 11). EMD moves only via the wallet boundary. Money
// never leaves to a seller here — the winner is announced via the outbox (auctions.auction_won);
// order creation is downstream. Gated by the `auctions` feature flag.
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { AuctionsController } from './controllers/v1/auctions.controller';
import { BidsController } from './controllers/v1/bids.controller';
import { AuctionService } from './services/auction.service';
import { BidService } from './services/bid.service';
import { AuctionWatcherService } from './services/auction-watcher.service';
import { AuctionsPublisher } from './events/auctions.publisher';
import { AuctionPaymentSucceededHandler } from './events/handlers/payment-succeeded.handler';
import { AuctionRepository } from './repositories/auction.repository';
import { BidRepository } from './repositories/bid.repository';
import { AuctionWatcherRepository } from './repositories/auction-watcher.repository';
import { AuctionLiveReadModel } from './read-models/auction-live.read-model';

// The open/close/EMD-release worker jobs (jobs/*.job.ts) are instantiated by apps/worker with a
// privileged kv_relay Pool — not DI providers (they take a Pool), mirroring the payout/image jobs.
@Module({
  imports: [ListingsModule],
  controllers: [AuctionsController, BidsController],
  providers: [
    AuctionService, BidService, AuctionWatcherService, AuctionsPublisher, AuctionPaymentSucceededHandler,
    AuctionRepository, BidRepository, AuctionWatcherRepository, AuctionLiveReadModel,
  ],
  exports: [AuctionService],
})
export class AuctionsModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly auctionPaymentSucceeded: AuctionPaymentSucceededHandler,
  ) {}
  // winner pays (referenceType='auction') → release the winner's EMD hold
  onModuleInit(): void { this.registry.register(this.auctionPaymentSucceeded); }
}
