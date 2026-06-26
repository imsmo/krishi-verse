// modules/listings/listings.module.ts
// Wires the listings bounded context into apps/api. Boundary rule (Law 11): other
// modules depend on the SERVICES exported here, never on repositories or the DB.
// Core infra (UnitOfWork, OutboxWriter, ReadReplica, Quota, Idempotency, Cache,
// Search, Metrics) is provided by CoreModule (global) and injected by token.
import { Module } from '@nestjs/common';
import { MediaModule } from '../../core/media/media.module';   // OBJECT_STORE for public listing-gallery presign

// Controllers (HTTP edge)
import { ListingsController } from './controllers/listings.controller';
import { BoostsController } from './controllers/boosts.controller';
import { GroupLotsController } from './controllers/group-lots.controller';
import { SellersController } from './controllers/sellers.controller';

// Application services
import { ListingService } from './services/listing.service';
import { ListingBoostService } from './services/listing-boost.service';
import { ListingViewService } from './services/listing-view.service';
import { ListingAttributeService } from './services/listing-attribute.service';
import { GroupLotService } from './services/group-lot.service';
import { GroupLotPledgeService } from './services/group-lot-pledge.service';

// Read-models (CQRS read path)
import { ListingSearchReadModel } from './read-models/listing-search.read-model';
import { MandiBandReadModel } from './read-models/mandi-band.read-model';
import { ListingAnalyticsReadModel } from './read-models/listing-analytics.read-model';
import { SellerProfileReadModel } from './read-models/seller-profile.read-model';
import { ListingGalleryReadModel } from './read-models/listing-gallery.read-model';
import { ListingLinksReadModel } from './read-models/listing-links.read-model';

// Repositories (write/read SQL)
import { ListingRepository } from './repositories/listing.repository';
import { PriceHistoryRepository } from './repositories/price-history.repository';
import { ListingAttributeRepository } from './repositories/listing-attribute.repository';
import { ListingBoostRepository } from './repositories/listing-boost.repository';
import { GroupLotRepository } from './repositories/group-lot.repository';
import { GroupLotPledgeRepository } from './repositories/group-lot-pledge.repository';
import { ListingMediaRepository } from './repositories/listing-media.repository';

// Event handlers (consume domain/integration events)
import { OrderCompletedHandler } from './events/handlers/order-completed.handler';
import { AuctionSettledHandler } from './events/handlers/auction-settled.handler';

// Scheduled jobs (run in worker; registered here so DI resolves their deps)
import { ExpireListingsJob } from './jobs/expire-listings.job';
import { BoostExpiryJob } from './jobs/boost-expiry.job';
import { PublishScheduledJob } from './jobs/publish-scheduled.job';

@Module({
  imports: [MediaModule],
  controllers: [ListingsController, BoostsController, GroupLotsController, SellersController],
  providers: [
    ListingService, ListingBoostService, ListingViewService, ListingAttributeService, GroupLotService, GroupLotPledgeService,
    ListingSearchReadModel, MandiBandReadModel, ListingAnalyticsReadModel, SellerProfileReadModel, ListingGalleryReadModel, ListingLinksReadModel,
    ListingRepository, PriceHistoryRepository, ListingAttributeRepository,
    ListingBoostRepository, GroupLotRepository, GroupLotPledgeRepository, ListingMediaRepository,
    OrderCompletedHandler, AuctionSettledHandler,
    ExpireListingsJob, BoostExpiryJob, PublishScheduledJob,
  ],
  // Export only what other bounded contexts may call (services + read-models).
  exports: [ListingService, GroupLotService, ListingSearchReadModel, MandiBandReadModel,
            ExpireListingsJob, BoostExpiryJob, PublishScheduledJob,
            OrderCompletedHandler, AuctionSettledHandler],
})
export class ListingsModule {}
