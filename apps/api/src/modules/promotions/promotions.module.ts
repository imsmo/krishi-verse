// modules/promotions/promotions.module.ts
// Promotions & coupons (PRD §9.5): tenant-admin campaigns (budgeted) + redeemable coupon codes with
// global/per-user caps. validate() previews a discount; redeem() is the atomic, capped, budget-bounded,
// append-only redemption (the source of truth a checkout integration calls to apply order.discount_minor).
// NO wallet movement — a discount is a price reduction; spent_minor is promo accounting. Gated by the
// `promotions` feature flag (default OFF).
//
// SCOPE: ships the coupon-discount engine (redeem() wired into orders' checkout), PLUS the async glue:
// the order-created backstop recorder (OrderCreatedHandler → CouponRedemptionService, idempotent on the
// redemption UNIQUE), and the budget-watch + festival-scheduler worker jobs. The cashback/recharge-bonus
// WALLET-credit promo types remain the documented next step.
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { PromotionsController } from './controllers/v1/promotions.controller';
import { CouponsController } from './controllers/v1/coupons.controller';
import { PromotionService } from './services/promotion.service';
import { CouponService } from './services/coupon.service';
import { CouponRedemptionService } from './services/coupon-redemption.service';
import { PromotionRepository } from './repositories/promotion.repository';
import { CouponRepository } from './repositories/coupon.repository';
import { CouponRedemptionRepository } from './repositories/coupon-redemption.repository';
import { OrderCreatedHandler } from './events/handlers/order-created.handler';

// The promo-budget-watch + festival-campaign-scheduler worker jobs (jobs/*.job.ts) are instantiated by
// apps/worker with a privileged kv_relay Pool — not DI providers (they take a Pool) — mirroring the
// other sweeps; they call PromotionService per-tenant.
@Module({
  controllers: [PromotionsController, CouponsController],
  providers: [PromotionService, CouponService, CouponRedemptionService, PromotionRepository, CouponRepository, CouponRedemptionRepository, OrderCreatedHandler],
  exports: [PromotionService, CouponService, CouponRedemptionService],
})
export class PromotionsModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly orderCreated: OrderCreatedHandler,
  ) {}
  // record the coupon redemption when an order carrying a coupon is created (orders.order_created)
  onModuleInit(): void { this.registry.register(this.orderCreated); }
}
