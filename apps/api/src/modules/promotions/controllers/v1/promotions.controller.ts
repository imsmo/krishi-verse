// modules/promotions/controllers/v1/promotions.controller.ts · promotion admin (validate→authorize→
// delegate). All endpoints need promotion.manage. Gated by the `promotions` feature flag.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { PromotionService } from '../../services/promotion.service';
import { CreatePromotionSchema, CreatePromotionDto } from '../../dto/create-promotion.dto';
import { SetPromotionActiveSchema, SetPromotionActiveDto } from '../../dto/update-promotion.dto';
import { QueryPromotionsSchema, QueryPromotionsDto } from '../../dto/query-promotion.dto';
import { PromotionPermissions, canManagePromotions } from '../../policies/promotions.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'promotions', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManagePromotions(ctx) }; }

  @Post() @RequirePermissions(PromotionPermissions.Manage)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreatePromotionSchema) dto: CreatePromotionDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.promotions.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }

  @Get() @RequirePermissions(PromotionPermissions.Manage)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryPromotionsSchema) q: QueryPromotionsDto) {
    return this.promotions.list(ctx.tenantId, this.actor(ctx), { activeOnly: q.activeOnly, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id') @RequirePermissions(PromotionPermissions.Manage)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.promotions.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/active') @RequirePermissions(PromotionPermissions.Manage)
  setActive(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(SetPromotionActiveSchema) dto: SetPromotionActiveDto) {
    return this.promotions.setActive(ctx.tenantId, this.actor(ctx), id, dto.isActive, ipOf(r)).then((data) => ({ data }));
  }
}
