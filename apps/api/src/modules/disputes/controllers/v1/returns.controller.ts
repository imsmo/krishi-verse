// modules/disputes/controllers/v1/returns.controller.ts · returns/RMA lifecycle (validate→authorize→
// delegate). Request needs dispute.raise + Idempotency-Key (eligibility enforced in the service — only
// the order's buyer); approve/reject/receive are seller-or-moderator, ship is buyer-or-moderator,
// refund needs dispute.resolve. Party-vs-party authority is enforced per-row from eligibility. Gated by
// the `disputes` feature flag.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ReturnService } from '../../services/return.service';
import { CreateReturnSchema, CreateReturnDto } from '../../dto/create-return.dto';
import { QueryReturnsSchema, QueryReturnsDto } from '../../dto/query-return.dto';
import { DisputePermissions, canModerateDispute } from '../../policies/disputes.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'returns', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('disputes')
export class ReturnsController {
  constructor(private readonly returns: ReturnService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateDispute(ctx) }; }

  @Post() @RequirePermissions(DisputePermissions.Raise)
  request(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateReturnSchema) dto: CreateReturnDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.returns.request(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryReturnsSchema) q: QueryReturnsDto) {
    return this.returns.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.returns.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/approve')
  approve(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.returns.approve(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/reject')
  reject(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.returns.reject(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/ship')
  ship(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.returns.ship(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/receive')
  receive(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.returns.receive(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/refund') @RequirePermissions(DisputePermissions.Resolve)
  refund(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.returns.refund(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }
}
