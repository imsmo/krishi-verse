// modules/disputes/controllers/v1/disputes.controller.ts · dispute lifecycle (validate→authorize→
// delegate). Raise needs dispute.raise + Idempotency-Key (eligibility enforced in the service); respond/
// withdraw are party actions; review/escalate/resolve need dispute.resolve. Threaded evidence via
// messages. Party-vs-party authority is enforced per-row. Gated by the `disputes` feature flag.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { DisputeService } from '../../services/dispute.service';
import { CreateDisputeSchema, CreateDisputeDto } from '../../dto/create-dispute.dto';
import { ResolveDisputeSchema, ResolveDisputeDto } from '../../dto/update-dispute.dto';
import { CreateDisputeMessageSchema, CreateDisputeMessageDto } from '../../dto/create-dispute-message.dto';
import { QueryDisputesSchema, QueryDisputesDto } from '../../dto/query-dispute.dto';
import { QueryDisputeMessagesSchema, QueryDisputeMessagesDto } from '../../dto/query-dispute-message.dto';
import { DisputePermissions, canModerateDispute } from '../../policies/disputes.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'disputes', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputeService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateDispute(ctx) }; }

  @Post() @RequirePermissions(DisputePermissions.Raise)
  raise(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateDisputeSchema) dto: CreateDisputeDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.disputes.raise(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryDisputesSchema) q: QueryDisputesDto) {
    return this.disputes.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.disputes.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/respond')
  respond(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.disputes.respond(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/withdraw')
  withdraw(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.disputes.withdraw(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/messages')
  postMessage(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(CreateDisputeMessageSchema) dto: CreateDisputeMessageDto) {
    return this.disputes.postMessage(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data }));
  }
  @Get(':id/messages')
  listMessages(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodQuery(QueryDisputeMessagesSchema) q: QueryDisputeMessagesDto) {
    return this.disputes.listMessages(ctx.tenantId, this.actor(ctx), id, { cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Post(':id/review') @RequirePermissions(DisputePermissions.Resolve)
  review(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.disputes.startReview(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/escalate') @RequirePermissions(DisputePermissions.Resolve)
  escalate(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.disputes.escalate(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/resolve') @RequirePermissions(DisputePermissions.Resolve)
  resolve(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(ResolveDisputeSchema) dto: ResolveDisputeDto) {
    return this.disputes.resolve(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }
}
