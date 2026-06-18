// modules/memberships/controllers/v1/membership-tiers.controller.ts · tier admin + public browse.
// create/pause need membership.manage; list/get are any authenticated user (storefront). Gated by `memberships`.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { MembershipTierService } from '../../services/membership-tier.service';
import { CreateTierSchema, CreateTierDto } from '../../dto/create-membership-tier.dto';
import { SetTierActiveSchema, SetTierActiveDto } from '../../dto/update-membership-tier.dto';
import { QueryTiersSchema, QueryTiersDto } from '../../dto/query-membership-tier.dto';
import { MembershipPermissions, canManageMemberships } from '../../policies/memberships.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'membership-tiers', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('memberships')
export class MembershipTiersController {
  constructor(private readonly tiers: MembershipTierService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageMemberships(ctx) }; }

  @Post() @RequirePermissions(MembershipPermissions.Manage)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateTierSchema) dto: CreateTierDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.tiers.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryTiersSchema) q: QueryTiersDto) {
    return this.tiers.list(ctx.tenantId, { activeOnly: q.activeOnly, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.tiers.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/active') @RequirePermissions(MembershipPermissions.Manage)
  setActive(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(SetTierActiveSchema) dto: SetTierActiveDto) {
    return this.tiers.setActive(ctx.tenantId, this.actor(ctx), id, dto.isActive, ipOf(r)).then((data) => ({ data }));
  }
}
