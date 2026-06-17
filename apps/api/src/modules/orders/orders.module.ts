// modules/orders/orders.module.ts
// Cart → checkout → order lifecycle. Reads listing price/seller via ListingService (cross-module
// public API, Law 11 — never the listings repository). The money/payment step is owned by the
// payments module and gated by the `online_payments` feature flag until wallet-service lands.
import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { CartsController } from './controllers/v1/carts.controller';
import { CheckoutController } from './controllers/v1/checkout.controller';
import { OrdersController } from './controllers/v1/orders.controller';
import { CartService } from './services/cart.service';
import { CheckoutService } from './services/checkout.service';
import { OrderService } from './services/order.service';
import { OrderTimelineReadModel } from './read-models/order-timeline.read-model';
import { CartRepository } from './repositories/cart.repository';
import { OrderRepository } from './repositories/order.repository';
import { SellerConfirmTimeoutJob } from './jobs/seller-confirm-timeout.job';
import { AutoCompleteQualityWindowJob } from './jobs/auto-complete-quality-window.job';
import { AbandonedCartsJob } from './jobs/abandoned-carts.job';

@Module({
  imports: [ListingsModule],
  controllers: [CartsController, CheckoutController, OrdersController],
  providers: [
    CartService, CheckoutService, OrderService, OrderTimelineReadModel,
    CartRepository, OrderRepository,
    SellerConfirmTimeoutJob, AutoCompleteQualityWindowJob, AbandonedCartsJob,
  ],
  exports: [OrderService, SellerConfirmTimeoutJob, AutoCompleteQualityWindowJob, AbandonedCartsJob],
})
export class OrdersModule {}
