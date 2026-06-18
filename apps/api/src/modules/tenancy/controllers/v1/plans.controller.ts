// modules/tenancy/controllers/v1/plans.controller.ts · SaaS plan catalogue. create/pause need plan.manage
// (platform admin, god-mode — Law 11); list/get are any authenticated user (browse public plans). Gated
// by the `tenancy` feature flag.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { PlanService } from '../../services/plan.service';
import { CreatePlanSchema, CreatePlanDto } from '../../dto/create-plan.dto';
import { SetPlanActiveSchema, SetPlanActiveDto } from '../../dto/update-plan.dto';
import { QueryPlansSchema, QueryPlansDto } from '../../dto/query-plan.dto';
import { TenancyPermissions, actorOf } from '../../policies/tenancy.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'plans', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('tenancy')
export class PlansController {
  constructor(private readonly plans: PlanService) {}

  @Post() @RequirePermissions(TenancyPermissions.ManagePlans)
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreatePlanSchema) dto: CreatePlanDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.plans.create(actorOf(ctx), key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryPlansSchema) q: QueryPlansDto) {
    return this.plans.list(ctx.tenantId, actorOf(ctx), { cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.plans.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post(':id/active') @RequirePermissions(TenancyPermissions.ManagePlans)
  setActive(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(SetPlanActiveSchema) dto: SetPlanActiveDto) {
    return this.plans.setActive(actorOf(ctx), id, dto.isActive, ipOf(r)).then((data) => ({ data }));
  }
}
