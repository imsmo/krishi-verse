// apps/api/src/app.module.ts · ROOT WIRING
// Order matters: core plumbing first, then business modules. A module not
// imported here does not exist at runtime — this file IS the tree's trunk.
// Phase 1 wires the listings vertical slice end-to-end; the remaining PRD
// modules are added here one by one as they are implemented (copy listings).
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { RequestIdMiddleware } from './core/http/request-id.middleware';
import { TenantContextMiddleware } from './core/tenancy-context/tenant-context.middleware';
import { ListingsModule } from './modules/listings/listings.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MediaModule } from './core/media/media.module';
import { AuctionsModule } from './modules/auctions/auctions.module';
import { OffersModule } from './modules/offers/offers.module';
import { RequirementsModule } from './modules/requirements/requirements.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { LabourModule } from './modules/labour/labour.module';
import { LivestockModule } from './modules/livestock/livestock.module';
import { DairyModule } from './modules/dairy/dairy.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { WarehousingModule } from './modules/warehousing/warehousing.module';
import { ContractFarmingModule } from './modules/contract-farming/contract-farming.module';
import { ExportsModule } from './modules/exports/exports.module';
import { LandSoilWeatherModule } from './modules/land-soil-weather/land-soil-weather.module';
import { FintechModule } from './modules/fintech/fintech.module';
import { SchemesModule } from './modules/schemes/schemes.module';
import { ServicesMarketplaceModule } from './modules/services-marketplace/services-marketplace.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';

@Module({
  imports: [CoreModule, IdentityModule, CatalogueModule, ListingsModule, OrdersModule, PaymentsModule, MediaModule, AuctionsModule, OffersModule, RequirementsModule, LogisticsModule, ReviewsModule, DisputesModule, PromotionsModule, MembershipsModule, TenancyModule, LabourModule, LivestockModule, DairyModule, EquipmentModule, WarehousingModule, ContractFarmingModule, ExportsModule, LandSoilWeatherModule, FintechModule, SchemesModule, ServicesMarketplaceModule, CommunicationModule],
})
export class AppModule implements NestModule {
  // request-id THEN tenant-context (Law 1) on every route.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
