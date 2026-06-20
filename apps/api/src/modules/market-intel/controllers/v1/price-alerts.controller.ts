// modules/market-intel/controllers/v1/price-alerts.controller.ts · a farmer's own price-threshold alerts.
// All operations act on the caller's own alerts (ownership server-side; a non-owner toggle 404s). `market_intel` flag.
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { PriceAlertService } from '../../services/price-alert.service';
import { canManageMarket } from '../../policies/market-intel.policies';
import { CreateAlertSchema, CreateAlertDto } from '../../dto/create-price-alert.dto';
import { QueryAlertsSchema, QueryAlertsDto } from '../../dto/query-price-alert.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'market/alerts', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('market_intel')
export class PriceAlertsController {
  constructor(private readonly svc: PriceAlertService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageMarket(ctx) }; }

  @Post()
  create(@CurrentContext() ctx: RequestContext, @ZodBody(CreateAlertSchema) dto: CreateAlertDto) { return this.svc.create(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAlertsSchema) q: QueryAlertsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { activeOnly: q.activeOnly, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Post(':id/activate')
  activate(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setActive(ctx.tenantId, this.actor(ctx), id, true).then((data) => ({ data })); }
  @Post(':id/deactivate')
  deactivate(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setActive(ctx.tenantId, this.actor(ctx), id, false).then((data) => ({ data })); }
}
