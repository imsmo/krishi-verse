// modules/memberships/controllers/v1/memberships.controller.ts · subscribe/renew/cancel + my membership.
// Subscribe/renew/cancel act on the CALLER's own membership (the userId is ctx.userId, never client-
// supplied); the tenant-wide list (box=all) needs membership.manage. Gated by the `memberships` flag.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { UserMembershipService } from '../../services/user-membership.service';
import { SubscribeSchema, SubscribeDto } from '../../dto/create-user-membership.dto';
import { QueryMembershipsSchema, QueryMembershipsDto } from '../../dto/query-user-membership.dto';
import { canManageMemberships } from '../../policies/memberships.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'memberships', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('memberships')
export class MembershipsController {
  constructor(private readonly memberships: UserMembershipService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageMemberships(ctx) }; }

  @Post('subscribe')
  subscribe(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(SubscribeSchema) dto: SubscribeDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.memberships.subscribe(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get('me')
  me(@CurrentContext() ctx: RequestContext) { return this.memberships.getMine(ctx.tenantId, ctx.userId).then((data) => ({ data })); }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryMembershipsSchema) q: QueryMembershipsDto) {
    return this.memberships.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Post(':id/renew')
  renew(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @Param('id') id: string) {
    return this.memberships.renew(ctx.tenantId, ctx.userId, id).then((data) => ({ data }));
  }

  @Post(':id/cancel')
  cancel(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.memberships.cancel(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }
}
