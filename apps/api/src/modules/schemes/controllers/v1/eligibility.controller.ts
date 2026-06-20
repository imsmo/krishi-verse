// modules/schemes/controllers/v1/eligibility.controller.ts · explainable scheme eligibility checker. `schemes` flag.
// Read-only, side-effect-free: evaluates the supplied applicant attributes against a scheme's machine-
// readable rules and returns eligible/ineligible + the explaining reasons. Any authenticated tenant user.
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { SchemeService } from '../../services/scheme.service';
import { CheckEligibilitySchema, CheckEligibilityDto } from '../../dto/query-scheme.dto';

@Controller({ path: 'schemes', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('schemes')
export class EligibilityController {
  constructor(private readonly svc: SchemeService) {}
  @Post(':id/eligibility')
  check(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(CheckEligibilitySchema) dto: CheckEligibilityDto) {
    return this.svc.checkEligibility(ctx.tenantId, id, dto).then((data) => ({ data }));
  }
}
