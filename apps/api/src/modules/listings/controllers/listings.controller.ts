// modules/listings/controllers/listings.controller.ts
// HTTP edge for the listings aggregate. Responsibilities ONLY: authn/authz guards,
// DTO (zod) validation, tenant/idempotency header extraction, mapping to service
// calls, and envelope shaping. No business logic lives here. Browse/detail are
// @Public (anonymous storefront; tenant resolved from token or X-Tenant-Id).
import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../core/auth/permissions.guard';
import { Public } from '../../../core/auth/public.decorator';
import { ZodBody, ZodQuery } from '../../../core/http/zod.pipe';
import { CurrentContext } from '../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../shared/errors/app-error';
import { ListingService } from '../services/listing.service';
import { ListingSearchReadModel } from '../read-models/listing-search.read-model';
import { ListingAnalyticsReadModel } from '../read-models/listing-analytics.read-model';
import { ListingGalleryReadModel } from '../read-models/listing-gallery.read-model';
import { ListingBoostService } from '../services/listing-boost.service';
import { CreateListingDto, CreateListingSchema } from '../dto/create-listing.dto';
import { ChangePriceDto, ChangePriceSchema } from '../dto/change-price.dto';
import { QueryListingDto, QueryListingSchema } from '../dto/query-listing.dto';
import { ListingNotFoundError } from '../domain/listing.errors';
import { ListingPermissions, canModerate } from '../listings.policies';

@Controller({ path: 'listings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class ListingsController {
  constructor(
    private readonly service: ListingService,
    private readonly searchRM: ListingSearchReadModel,
    private readonly analyticsRM: ListingAnalyticsReadModel,
    private readonly galleryRM: ListingGalleryReadModel,
    private readonly boosts: ListingBoostService,
  ) {}

  /** Public browse/search — replica-backed read-model; tenant scoped + RLS. */
  @Public() @Get()
  async search(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryListingSchema) q: QueryListingDto) {
    const res = await this.searchRM.query(ctx.tenantId, q);
    return { data: res.items, meta: { total: res.total, nextCursor: res.nextCursor } };
  }

  // Static routes BEFORE ':id' so they aren't captured as a listing id.
  /** The paid-boost tier catalogue (id + name + server price/days) — so the client shows real prices. */
  @Get('boost-tiers')
  boostTiers(@CurrentContext() ctx: RequestContext) { return this.boosts.tiers(ctx.tenantId).then((data) => ({ data })); }

  @Public() @Get(':id')
  async getOne(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    // visibility-gated: non-owners only see published+public listings (no draft scraping)
    const l = await this.service.getPublicById(ctx.tenantId, id, { userId: ctx.userId, canModerate: canModerate(ctx) });
    return { data: l };
  }

  /** Signed photo gallery for a PUBLIC listing (short-lived presigned GET urls; clean assets only). Public. */
  @Public() @Get(':id/media')
  async media(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    const g = await this.galleryRM.forListing(ctx.tenantId, id);
    return { data: g.items, meta: { expiresInSec: g.expiresInSec } };
  }

  @Post()
  @RequirePermissions(ListingPermissions.Create)
  async create(
    @CurrentContext() ctx: RequestContext,
    @Headers('idempotency-key') idemKey: string,
    @ZodBody(CreateListingSchema) dto: CreateListingDto,
  ) {
    if (!idemKey) throw new BadRequestError('Idempotency-Key header required');
    const { id } = await this.service.create(ctx.tenantId, ctx.userId, idemKey, dto);
    return { data: { id } };
  }

  /** Seller engagement analytics for their OWN listing (offers / price changes / boosts). Owner-only:
   *  a non-owner non-moderator gets 404 (anti-IDOR, no enumeration). Derived from real data, no fake views. */
  @Get(':id/analytics')
  async analytics(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    const data = await this.analyticsRM.forSeller(ctx.tenantId, id, ctx.userId, canModerate(ctx));
    if (!data) throw new ListingNotFoundError(id);
    return { data };
  }

  @Post(':id/publish')
  @RequirePermissions(ListingPermissions.Publish)
  async publish(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    await this.service.publish(ctx.tenantId, { userId: ctx.userId, canModerate: canModerate(ctx) }, id);
    return { data: { ok: true } };
  }

  @Patch(':id/price')
  @RequirePermissions(ListingPermissions.Update)
  async changePrice(
    @CurrentContext() ctx: RequestContext, @Param('id') id: string,
    @ZodBody(ChangePriceSchema) dto: ChangePriceDto,
  ) {
    await this.service.changePrice(
      ctx.tenantId, { userId: ctx.userId, canModerate: canModerate(ctx) },
      id, BigInt(dto.priceMinor), dto.expectedVersion,
    );
    return { data: { ok: true } };
  }
}
