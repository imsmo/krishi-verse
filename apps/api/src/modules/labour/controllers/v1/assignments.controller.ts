// modules/labour/controllers/v1/assignments.controller.ts · the WORKER side: respond to + list assignments.
// Responding (accept/reject) acts on the caller's OWN assignment (ownership resolved server-side from the
// caller's worker profile — anti-IDOR). Listing 'mine' is the caller's; 'booking' is the employer's view.
// Gated by the `labour` flag.
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { LabourBookingService } from '../../services/labour-booking.service';
import { AttendanceService } from '../../services/attendance.service';
import { RespondAssignmentSchema, RespondAssignmentDto } from '../../dto/create-booking-assignment.dto';
import { QueryAssignmentsSchema, QueryAssignmentsDto } from '../../dto/query-booking-assignment.dto';
import { ClockInSchema, ClockInDto } from '../../dto/create-attendance.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'labour/assignments', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('labour')
export class AssignmentsController {
  constructor(private readonly svc: LabourBookingService, private readonly attendance: AttendanceService) {}

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAssignmentsSchema) q: QueryAssignmentsDto) {
    return this.svc.listAssignments(ctx.tenantId, ctx.userId, { box: q.box, bookingId: q.bookingId, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getAssignment(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/respond')
  respond(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(RespondAssignmentSchema) dto: RespondAssignmentDto) {
    return this.svc.respond(ctx.tenantId, ctx.userId, id, { decision: dto.decision, voiceConsentMediaId: dto.voiceConsentMediaId }).then((data) => ({ data }));
  }

  /** WORKER clocks in for today on their OWN accepted assignment. The device sends only its GPS fix; the
   *  ≤100m farm fence is computed + enforced SERVER-side (anti-spoof). State-advancing → Idempotency-Key (Law 3). */
  @Post(':id/attendance')
  clockIn(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(ClockInSchema) dto: ClockInDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.attendance.clockIn(ctx.tenantId, ctx.userId, id, { lat: dto.lat, lng: dto.lng }, key).then((data) => ({ data }));
  }
}
