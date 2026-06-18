// modules/promotions/promotions.module.ts
// Promotions & coupons (PRD §9.5): tenant-admin campaigns (budgeted) + redeemable coupon codes with
// global/per-user caps. validate() previews a discount; redeem() is the atomic, capped, budget-bounded,
// append-only redemption (the source of truth a checkout integration calls to apply order.discount_minor).
// NO wallet movement — a discount is a price reduction; spent_minor is promo accounting. Gated by the
// `promotions` feature flag (default OFF).
//
// SCOPE: this build ships the coupon-discount engine. Wiring redeem() INTO orders' checkout (set
// discount_minor + redeem in the checkout tx), and the cashback/recharge-bonus WALLET-credit promo
// types, are the documented next steps (the order-created handler + jobs are left as stubs).
import { Module } from '@nestjs/common';
import { PromotionsController } from './controllers/v1/promotions.controller';
import { CouponsController } from './controllers/v1/coupons.controller';
import { PromotionService } from './services/promotion.service';
import { CouponService } from './services/coupon.service';
import { PromotionRepository } from './repositories/promotion.repository';
import { CouponRepository } from './repositories/coupon.repository';
import { CouponRedemptionRepository } from './repositories/coupon-redemption.repository';

@Module({
  controllers: [PromotionsController, CouponsController],
  providers: [PromotionService, CouponService, PromotionRepository, CouponRepository, CouponRedemptionRepository],
  exports: [PromotionService, CouponService],
})
export class PromotionsModule {}
