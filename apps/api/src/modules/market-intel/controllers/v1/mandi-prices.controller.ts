// modules/market-intel/controllers/v1/mandi-prices.controller.ts · Mandi Pulse: mandi browse + price ingest +
// history + the composite pulse read. ingest needs market.manage (Idempotency-Key, money-bearing observation);
// browse/pulse are any authenticated user. `market_intel` flag.
import { Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { MandiService } from '../../services/mandi.service';
import { MandiPriceService } from '../../services/mandi-price.service';
import { MandiPulseReadModel } from '../../read-models/mandi-pulse.read-model';
import { MarketPermissions, canManageMarket } from '../../policies/market-intel.policies';
import { IngestPriceSchema, IngestPriceDto } from '../../dto/create-mandi-price.dto';
import { QueryPricesSchema, QueryPricesDto } from '../../dto/query-mandi-price.dto';
import { QueryMandisSchema, QueryMandisDto } from '../../dto/query-mandi.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'market', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('market_intel')
export class MandiPricesController {
  constructor(private readonly mandis: MandiService, private readonly prices: MandiPriceService, private readonly pulse: MandiPulseReadModel) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageMarket(ctx) }; }

  @Get('mandis')
  listMandis(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryMandisSchema) q: QueryMandisDto) {
    return this.mandis.list(ctx.tenantId, { regionId: q.regionId, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('mandis/:id')
  getMandi(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.mandis.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post('prices') @RequirePermissions(MarketPermissions.Manage)
  ingest(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(IngestPriceSchema) dto: IngestPriceDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.prices.ingest(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get('prices')
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryPricesSchema) q: QueryPricesDto) {
    return this.prices.list(ctx.tenantId, { productId: q.productId, regionId: q.regionId, mandiId: q.mandiId, fromDate: q.fromDate, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('pulse')
  getPulse(@CurrentContext() ctx: RequestContext, @Query('productId') productId: string, @Query('regionId') regionId?: string) {
    if (!productId) throw new BadRequestError('productId required');
    return this.pulse.pulse(ctx.tenantId, productId, regionId ?? null).then((data) => ({ data }));
  }
}
