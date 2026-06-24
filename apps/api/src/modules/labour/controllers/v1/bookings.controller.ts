// modules/labour/controllers/v1/bookings.controller.ts · employer booking lifecycle + wage settlement.
// Posting/assigning/starting/completing/paying need worker.book (an employer); the booking owner OR an
// admin (booking.manage) may act on a given booking. Money-moving routes (create, assign, pay) require an
// Idempotency-Key (Law 3). Gated by the `labour` flag.
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { LabourBookingService } from '../../services/labour-booking.service';
import { CreateBookingSchema, CreateBookingDto } from '../../dto/create-labour-booking.dto';
import { QueryBookingsSchema, QueryBookingsDto } from '../../dto/query-labour-booking.dto';
import { AssignWorkerSchema, AssignWorkerDto } from '../../dto/create-booking-assignment.dto';
import { LabourPermissions, canBookLabour, canManageLabour } from '../../policies/labour.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'labour/bookings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('labour')
export class BookingsController {
  constructor(private readonly svc: LabourBookingService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canBook: canBookLabour(ctx), canManage: canManageLabour(ctx) }; }

  @Post() @RequirePermissions(LabourPermissions.Book)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateBookingSchema) dto: CreateBookingDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryBookingsSchema) q: QueryBookingsDto) {
    return this.svc.listBookings(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, taskSkillId: q.taskSkillId, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getBooking(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/assignments') @RequirePermissions(LabourPermissions.Book)
  assign(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(AssignWorkerSchema) dto: AssignWorkerDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.assign(ctx.tenantId, this.actor(ctx), id, key, { workerId: dto.workerId, wageMinor: dto.wageMinor }).then((data) => ({ data }));
  }

  /** WORKER self-applies to an open booking (any authenticated worker — not the employer's worker.book). The
   *  caller's own worker profile is resolved from the token (no IDOR); idempotent on the caller's key (Law 3). */
  @Post(':id/apply')
  apply(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.applyAsWorker(ctx.tenantId, ctx.userId, id, key).then((data) => ({ data }));
  }

  @Post(':id/start') @RequirePermissions(LabourPermissions.Book)
  start(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.start(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/complete') @RequirePermissions(LabourPermissions.Book)
  complete(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.complete(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/cancel') @RequirePermissions(LabourPermissions.Book)
  cancel(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Body('reason') reason?: string) { return this.svc.cancel(ctx.tenantId, this.actor(ctx), id, reason).then((data) => ({ data })); }

  @Post(':id/pay') @RequirePermissions(LabourPermissions.Book)
  pay(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.payWages(ctx.tenantId, this.actor(ctx), id, key).then((data) => ({ data }));
  }
}
