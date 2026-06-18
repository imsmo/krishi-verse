// modules/promotions/controllers/v1/coupons.controller.ts · coupon admin + validate (preview) + redeem.
// Create/delete/list need promotion.manage; validate/redeem/my-redemptions are any authenticated user
// (caps enforced in the service). Gated by the `promotions` feature flag.
import { Controller, Delete, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { CouponService } from '../../services/coupon.service';
import { CreateCouponSchema, CreateCouponDto } from '../../dto/create-coupon.dto';
import { ValidateCouponSchema, ValidateCouponDto, RedeemCouponSchema, RedeemCouponDto } from '../../dto/create-coupon-redemption.dto';
import { QueryCouponsSchema, QueryCouponsDto } from '../../dto/query-coupon.dto';
import { QueryRedemptionsSchema, QueryRedemptionsDto } from '../../dto/query-coupon-redemption.dto';
import { PromotionPermissions, canManagePromotions } from '../../policies/promotions.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'coupons', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('promotions')
export class CouponsController {
  constructor(private readonly coupons: CouponService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManagePromotions(ctx) }; }

  @Post() @RequirePermissions(PromotionPermissions.Manage)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateCouponSchema) dto: CreateCouponDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.coupons.createCoupon(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }

  @Get() @RequirePermissions(PromotionPermissions.Manage)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryCouponsSchema) q: QueryCouponsDto) {
    return this.coupons.listForPromotion(ctx.tenantId, this.actor(ctx), q.promotionId, { cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get('redemptions')
  myRedemptions(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryRedemptionsSchema) q: QueryRedemptionsDto) {
    return this.coupons.listMyRedemptions(ctx.tenantId, ctx.userId, { cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Post('validate')
  validate(@CurrentContext() ctx: RequestContext, @ZodBody(ValidateCouponSchema) dto: ValidateCouponDto) {
    return this.coupons.validate(ctx.tenantId, dto.code, BigInt(dto.subtotalMinor)).then((data) => ({ data }));
  }

  @Post('redeem')
  redeem(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(RedeemCouponSchema) dto: RedeemCouponDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.coupons.redeem(ctx.tenantId, ctx.userId, key, { code: dto.code, orderId: dto.orderId, subtotalMinor: BigInt(dto.subtotalMinor) }).then((data) => ({ data }));
  }

  @Delete(':id') @RequirePermissions(PromotionPermissions.Manage)
  remove(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.coupons.deleteCoupon(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }
}
