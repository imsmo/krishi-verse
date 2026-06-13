// modules/listings/controllers/listings.controller.ts
// HTTP edge for the listings aggregate. Responsibilities ONLY: authn/authz guards,
// DTO (zod) validation, tenant/idempotency header extraction, mapping to service
// calls, and envelope shaping. No business logic lives here.
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../core/auth/permissions.guard';
import { ZodBody, ZodQuery } from '../../../core/http/zod.pipe';
import { CurrentContext } from '../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../core/tenancy-context/request-context';
import { ListingService } from '../services/listing.service';
import { ListingSearchReadModel } from '../read-models/listing-search.read-model';
import { CreateListingDto, CreateListingSchema } from '../dto/create-listing.dto';
import { ChangePriceDto, ChangePriceSchema } from '../dto/change-price.dto';
import { QueryListingDto, QueryListingSchema } from '../dto/query-listing.dto';
import { ListingPermissions } from '../listings.policies';

@Controller({ path: 'listings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class ListingsController {
  constructor(
    private readonly service: ListingService,
    private readonly searchRM: ListingSearchReadModel,
  ) {}

  /** Public browse/search — read-model only, no auth on read path beyond tenant resolution. */
  @Get()
  async search(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryListingSchema) q: QueryListingDto) {
    const res = await this.searchRM.query(ctx.tenantId, q);
    return { data: res.items, meta: { total: res.total, nextCursor: res.nextCursor } };
  }

  @Get(':id')
  async getOne(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    const l = await this.service.getById(ctx.tenantId, id);
    return { data: l };
  }

  @Post()
  @RequirePermissions(ListingPermissions.Create)
  async create(
    @CurrentContext() ctx: RequestContext,
    @Headers('idempotency-key') idemKey: string,
    @ZodBody(CreateListingSchema) dto: CreateListingDto,
  ) {
    if (!idemKey) { const { BadRequestError } = require('../../../shared/errors/app-error'); throw new BadRequestError('Idempotency-Key header required'); }
    const { id } = await this.service.create(ctx.tenantId, ctx.userId, idemKey, dto);
    return { data: { id } };
  }

  @Post(':id/publish')
  @RequirePermissions(ListingPermissions.Publish)
  async publish(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    await this.service.publish(ctx.tenantId, ctx.userId, id);
    return { data: { ok: true } };
  }

  @Patch(':id/price')
  @RequirePermissions(ListingPermissions.Update)
  async changePrice(
    @CurrentContext() ctx: RequestContext, @Param('id') id: string,
    @ZodBody(ChangePriceSchema) dto: ChangePriceDto,
  ) {
    await this.service.changePrice(ctx.tenantId, ctx.userId, id, BigInt(dto.newPriceMinor), dto.expectedVersion);
    return { data: { ok: true } };
  }
}
