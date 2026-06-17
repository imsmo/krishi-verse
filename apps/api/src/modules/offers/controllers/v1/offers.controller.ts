// modules/offers/controllers/v1/offers.controller.ts · offer negotiation (validate→authorize→delegate).
// Make needs offer.create + an Idempotency-Key. counter/accept/reject are party-authorized in the
// service (buyer vs the listing's seller). List/get are scoped to the caller's own offers (buyer) or
// the listings they own (seller). Gated by the `offers` feature flag (default OFF).
import { Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ListingOfferService } from '../../services/listing-offer.service';
import { CreateOfferSchema, CreateOfferDto } from '../../dto/create-listing-offer.dto';
import { CounterOfferSchema, CounterOfferDto } from '../../dto/update-listing-offer.dto';
import { QueryOffersSchema, QueryOffersDto } from '../../dto/query-listing-offer.dto';
import { OfferPermissions, canModerateOffer } from '../../policies/offers.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'offers', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('offers')
export class OffersController {
  constructor(private readonly offers: ListingOfferService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateOffer(ctx) }; }

  @Post() @RequirePermissions(OfferPermissions.Create)
  make(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateOfferSchema) dto: CreateOfferDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.offers.make(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryOffersSchema) q: QueryOffersDto) {
    return this.offers.list(ctx.tenantId, this.actor(ctx), { box: q.box, listingId: q.listingId, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.offers.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/counter')
  counter(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(CounterOfferSchema) dto: CounterOfferDto) {
    return this.offers.counter(ctx.tenantId, this.actor(ctx), id, dto.priceMinor).then((data) => ({ data }));
  }

  @Post(':id/accept')
  accept(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.offers.accept(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/reject')
  reject(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.offers.reject(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
}
