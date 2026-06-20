// modules/services-marketplace/services-marketplace.module.ts
// Services-Marketplace (PRD M30): a peer-to-peer SERVICE MARKETPLACE — a provider publishes service offerings
// (priced per_hour/per_day/per_unit/per_person/per_visit/fixed); a customer requests a booking (fee snapshotted
// from the offering at request time); the provider drives the lifecycle (accept → start); on completion the
// CUSTOMER (payer) settles the fee through the wallet boundary (customer userMain → provider userMain,
// txnType 'service_fee', zero-sum + idempotent — Law 2). Gated by the `services_marketplace` flag (default OFF).
//
// SCOPE (this build): service offerings catalogue (provider-owned, CRUD + publish/pause/archive) + bookings
// (request → accept → start → complete-and-pay, + cancel) + fee settlement. Reuses the seeded `service_fee`
// ledger type and the `service_categories` master data (read-only, global).
import { Module } from '@nestjs/common';
import { OfferingsController } from './controllers/v1/offerings.controller';
import { BookingsController } from './controllers/v1/bookings.controller';
import { ServiceOfferingService } from './services/service-offering.service';
import { ServiceBookingService } from './services/service-booking.service';
import { ServiceOfferingRepository } from './repositories/service-offering.repository';
import { ServiceBookingRepository } from './repositories/service-booking.repository';

@Module({
  controllers: [OfferingsController, BookingsController],
  providers: [ServiceOfferingService, ServiceBookingService, ServiceOfferingRepository, ServiceBookingRepository],
  exports: [ServiceOfferingService, ServiceBookingService],
})
export class ServicesMarketplaceModule {}
