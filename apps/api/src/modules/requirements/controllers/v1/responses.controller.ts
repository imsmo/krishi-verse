// modules/requirements/controllers/v1/responses.controller.ts · acting on a single quote
// (shortlist/accept/reject by the buyer; reject = withdraw by the quote's seller). Authority is
// enforced per-row in the service. Gated by the `requirements` flag.
import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { RequirementResponseService } from '../../services/requirement-response.service';
import { canModerateRequirement } from '../../policies/requirements.policies';

const ipOf = (r: Request) => r.ip || null;

@Controller({ path: 'responses', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('requirements')
export class ResponsesController {
  constructor(private readonly responses: RequirementResponseService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateRequirement(ctx) }; }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.responses.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/shortlist')
  shortlist(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.responses.shortlist(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/accept')
  accept(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.responses.accept(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/reject')
  reject(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.responses.reject(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
}
