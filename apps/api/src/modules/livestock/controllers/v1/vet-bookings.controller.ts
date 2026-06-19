// modules/livestock/controllers/v1/vet-bookings.controller.ts · vet booking lifecycle + fee settlement.
// book/complete need vet.book (farmer, the payer); progress needs vet.manage (the assigned vet). Money-moving
// routes (book, pay) require an Idempotency-Key (Law 3). Ownership is resolved server-side. `livestock` flag.
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { VetBookingService } from '../../services/vet-booking.service';
import { BookVetSchema, BookVetDto, VetProgressSchema, VetProgressDto } from '../../dto/create-vet-booking.dto';
import { QueryVetBookingsSchema, QueryVetBookingsDto } from '../../dto/query-vet-booking.dto';
import { LivestockPermissions, canBookVet, canManageVet, isLivestockAdmin } from '../../policies/livestock.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'livestock/vet-bookings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('livestock')
export class VetBookingsController {
  constructor(private readonly svc: VetBookingService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canBook: canBookVet(ctx), canManageVet: canManageVet(ctx), isAdmin: isLivestockAdmin(ctx) }; }

  @Post() @RequirePermissions(LivestockPermissions.VetBook)
  book(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(BookVetSchema) dto: BookVetDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.book(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryVetBookingsSchema) q: QueryVetBookingsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/progress') @RequirePermissions(LivestockPermissions.VetManage)
  progress(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(VetProgressSchema) dto: VetProgressDto) { return this.svc.progress(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }

  @Post(':id/cancel') @RequirePermissions(LivestockPermissions.VetBook)
  cancel(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Body('reason') reason?: string) { return this.svc.cancel(ctx.tenantId, this.actor(ctx), id, reason).then((data) => ({ data })); }

  @Post(':id/complete') @RequirePermissions(LivestockPermissions.VetBook)
  complete(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.completeAndPay(ctx.tenantId, this.actor(ctx), id, key).then((data) => ({ data }));
  }
}
