// modules/services-marketplace/controllers/v1/bookings.controller.ts · service-booking lifecycle + fee settlement.
// request/complete need service.book (the customer, the payer); accept/start need service.offer (the provider).
// Money-moving routes (request, complete) require an Idempotency-Key (Law 3). Parties are resolved server-side;
// reads 404 for non-parties (no IDOR). `services_marketplace` flag.
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ServiceBookingService } from '../../services/service-booking.service';
import { RequestBookingSchema, RequestBookingDto } from '../../dto/create-service-booking.dto';
import { QueryBookingsSchema, QueryBookingsDto } from '../../dto/query-service-booking.dto';
import { ServicesPermissions, canOffer, canBook, isServicesAdmin } from '../../policies/services-marketplace.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'services/bookings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('services_marketplace')
export class BookingsController {
  constructor(private readonly svc: ServiceBookingService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canOffer: canOffer(ctx), canBook: canBook(ctx), isAdmin: isServicesAdmin(ctx) }; }

  @Post() @RequirePermissions(ServicesPermissions.Book)
  request(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(RequestBookingSchema) dto: RequestBookingDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.request(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryBookingsSchema) q: QueryBookingsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/accept') @RequirePermissions(ServicesPermissions.Offer)
  accept(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.accept(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/start') @RequirePermissions(ServicesPermissions.Offer)
  start(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.start(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/cancel')
  cancel(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Body('reason') reason?: string) { return this.svc.cancel(ctx.tenantId, this.actor(ctx), id, reason).then((data) => ({ data })); }

  @Post(':id/complete') @RequirePermissions(ServicesPermissions.Book)
  complete(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.completeAndPay(ctx.tenantId, this.actor(ctx), id, key).then((data) => ({ data }));
  }
}
