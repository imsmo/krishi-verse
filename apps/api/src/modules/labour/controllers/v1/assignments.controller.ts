// modules/labour/controllers/v1/assignments.controller.ts · the WORKER side: respond to + list assignments.
// Responding (accept/reject) acts on the caller's OWN assignment (ownership resolved server-side from the
// caller's worker profile — anti-IDOR). Listing 'mine' is the caller's; 'booking' is the employer's view.
// Gated by the `labour` flag.
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { LabourBookingService } from '../../services/labour-booking.service';
import { RespondAssignmentSchema, RespondAssignmentDto } from '../../dto/create-booking-assignment.dto';
import { QueryAssignmentsSchema, QueryAssignmentsDto } from '../../dto/query-booking-assignment.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'labour/assignments', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('labour')
export class AssignmentsController {
  constructor(private readonly svc: LabourBookingService) {}

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
}
