// modules/tenancy/controllers/v1/subscriptions.controller.ts · a tenant's subscription (the quota
// foundation). subscribe/change/cancel are enforced in the service (tenant.settings or plan.manage);
// GET /current + GET / are tenant-scoped reads. Gated by the `tenancy` feature flag.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { SubscriptionService } from '../../services/subscription.service';
import { SubscribeSchema, SubscribeDto, ChangePlanSchema, ChangePlanDto, CancelSubscriptionSchema, CancelSubscriptionDto } from '../../dto/create-subscription.dto';
import { QuerySubscriptionsSchema, QuerySubscriptionsDto } from '../../dto/query-subscription.dto';
import { actorOf } from '../../policies/tenancy.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'subscriptions', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('tenancy')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Post()
  subscribe(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(SubscribeSchema) dto: SubscribeDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.subscriptions.subscribe(ctx.tenantId, actorOf(ctx), key, dto).then((data) => ({ data }));
  }

  @Get('current')
  current(@CurrentContext() ctx: RequestContext) { return this.subscriptions.getCurrent(ctx.tenantId).then((data) => ({ data })); }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QuerySubscriptionsSchema) q: QuerySubscriptionsDto) {
    return this.subscriptions.list(ctx.tenantId, actorOf(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Post(':id/change-plan')
  changePlan(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(ChangePlanSchema) dto: ChangePlanDto) {
    return this.subscriptions.changePlan(ctx.tenantId, actorOf(ctx), id, dto.planId, ipOf(r)).then((data) => ({ data }));
  }

  @Post(':id/cancel')
  cancel(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(CancelSubscriptionSchema) dto: CancelSubscriptionDto) {
    return this.subscriptions.cancel(ctx.tenantId, actorOf(ctx), id, dto.atPeriodEnd, ipOf(r)).then((data) => ({ data }));
  }
}
