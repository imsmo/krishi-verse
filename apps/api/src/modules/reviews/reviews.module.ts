// modules/reviews/reviews.module.ts
// Verified-purchase ratings (M-reviews): a party to a COMPLETED order reviews the counterparty
// (buyer↔seller). Eligibility is recorded from orders.order_completed (OrderCompletedHandler); the
// service resolves the target server-side and enforces one-review-per-order. Moderation + cached
// aggregate (avg/count/histogram). NO money. Gated by the `reviews` feature flag (default OFF).
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { ReviewsController } from './controllers/v1/reviews.controller';
import { ReviewService } from './services/review.service';
import { ReviewRepository } from './repositories/review.repository';
import { OrderCompletedHandler } from './events/handlers/order-completed.handler';
import { BookingCompletedHandler } from './events/handlers/booking-completed.handler';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewService, ReviewRepository, OrderCompletedHandler, BookingCompletedHandler],
  exports: [ReviewService],
})
export class ReviewsModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly orderCompleted: OrderCompletedHandler,
    private readonly bookingCompleted: BookingCompletedHandler,
  ) {}
  // record verified-transaction eligibility when an order (orders.order_completed) OR a service booking
  // (services.booking_completed) completes → authorizes the counterparty review.
  onModuleInit(): void {
    this.registry.register(this.orderCompleted);
    this.registry.register(this.bookingCompleted);
  }
}
