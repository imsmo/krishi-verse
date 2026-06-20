// modules/services-marketplace/controllers/v1/offerings.controller.ts · provider service-offering catalogue.
// create/update/publish/pause/archive act on the CALLER's OWN offerings (provider = ctx.userId, never client-
// supplied; reads 404 on non-owner for the `mine`/`all` boxes — no cross-owner IDOR). Browse is any
// authenticated user with service.book/offer. create requires an Idempotency-Key (Law 3). `services_marketplace` flag.
import { Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ServiceOfferingService } from '../../services/service-offering.service';
import { CreateOfferingSchema, CreateOfferingDto } from '../../dto/create-service-offering.dto';
import { UpdateOfferingSchema, UpdateOfferingDto } from '../../dto/update-service-offering.dto';
import { QueryOfferingsSchema, QueryOfferingsDto } from '../../dto/query-service-offering.dto';
import { ServicesPermissions, canOffer, canBook, isServicesAdmin } from '../../policies/services-marketplace.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'services/offerings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('services_marketplace')
export class OfferingsController {
  constructor(private readonly svc: ServiceOfferingService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canOffer: canOffer(ctx), canBook: canBook(ctx), isAdmin: isServicesAdmin(ctx) }; }

  @Post() @RequirePermissions(ServicesPermissions.Offer)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateOfferingSchema) dto: CreateOfferingDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryOfferingsSchema) q: QueryOfferingsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, categoryId: q.categoryId, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Patch(':id') @RequirePermissions(ServicesPermissions.Offer)
  update(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpdateOfferingSchema) dto: UpdateOfferingDto) { return this.svc.update(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
  @Post(':id/publish') @RequirePermissions(ServicesPermissions.Offer)
  publish(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'publish').then((data) => ({ data })); }
  @Post(':id/pause') @RequirePermissions(ServicesPermissions.Offer)
  pause(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'pause').then((data) => ({ data })); }
  @Post(':id/archive') @RequirePermissions(ServicesPermissions.Offer)
  archive(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'archive').then((data) => ({ data })); }
}
