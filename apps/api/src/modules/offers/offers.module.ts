// modules/offers/offers.module.ts
// Buyer↔seller price negotiation (offers, counters, accept/reject, expiry) on a published listing.
// Reads the listing price/seller via ListingService (cross-module public API, Law 11). NO money
// moves here — an accepted offer is announced via the outbox (offers.offer_accepted); the order +
// payment are created downstream (orders). Gated by the `offers` feature flag (default OFF).
import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { OffersController } from './controllers/v1/offers.controller';
import { ListingOfferService } from './services/listing-offer.service';
import { ListingOfferRepository } from './repositories/listing-offer.repository';

// The expiry worker job (jobs/expire-offers.job.ts) is instantiated by apps/worker with a privileged
// kv_relay Pool — not a DI provider (it takes a Pool, not a token), mirroring the auction jobs.
@Module({
  imports: [ListingsModule],
  controllers: [OffersController],
  providers: [ListingOfferService, ListingOfferRepository],
  exports: [ListingOfferService],
})
export class OffersModule {}
