// modules/orders/orders.module.ts
// Cart → checkout → order lifecycle. Reads listing price/seller via ListingService (cross-module
// public API, Law 11 — never the listings repository). The money/payment step is owned by the
// payments module and gated by the `online_payments` feature flag; payment success flows back here
// via the outbox relay → PaymentSucceededHandler (no synchronous cross-module call).
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { PaymentsModule } from '../payments/payments.module';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
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
import { PaymentSucceededHandler } from './events/handlers/payment-succeeded.handler';
import { OfferAcceptedHandler } from './events/handlers/offer-accepted.handler';
import { QuoteAcceptedHandler } from './events/handlers/quote-accepted.handler';
import { ShipmentDeliveredHandler } from './events/handlers/shipment-delivered.handler';
import { DisputeOpenedHandler } from './events/handlers/dispute-opened.handler';
import { DisputeResolvedHandler } from './events/handlers/dispute-resolved.handler';

@Module({
  imports: [ListingsModule, PaymentsModule],   // PaymentsModule exports ChargePricingService (checkout fees)
  controllers: [CartsController, CheckoutController, OrdersController],
  providers: [
    CartService, CheckoutService, OrderService, OrderTimelineReadModel,
    CartRepository, OrderRepository,
    SellerConfirmTimeoutJob, AutoCompleteQualityWindowJob, AbandonedCartsJob,
    PaymentSucceededHandler, OfferAcceptedHandler, QuoteAcceptedHandler, ShipmentDeliveredHandler, DisputeOpenedHandler, DisputeResolvedHandler,
  ],
  exports: [OrderService, SellerConfirmTimeoutJob, AutoCompleteQualityWindowJob, AbandonedCartsJob],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly paymentSucceeded: PaymentSucceededHandler,
    private readonly offerAccepted: OfferAcceptedHandler,
    private readonly quoteAccepted: QuoteAcceptedHandler,
    private readonly shipmentDelivered: ShipmentDeliveredHandler,
    private readonly disputeOpened: DisputeOpenedHandler,
    private readonly disputeResolved: DisputeResolvedHandler,
  ) {}
  onModuleInit(): void { this.registry.register(this.paymentSucceeded); this.registry.register(this.offerAccepted); this.registry.register(this.quoteAccepted); this.registry.register(this.shipmentDelivered); this.registry.register(this.disputeOpened); this.registry.register(this.disputeResolved); }
}
