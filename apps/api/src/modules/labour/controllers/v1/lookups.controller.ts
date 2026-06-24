// modules/labour/controllers/v1/lookups.controller.ts · GET labour/lookups — the taxonomy catalogue clients
// need to render pickers (work-type, skill tree, region, skill-level) with real server ids instead of
// hard-coded UUIDs. Read-only; any authenticated user; gated by the `labour` flag.
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { LabourLookupsService } from '../../services/labour-lookups.service';

@Controller({ path: 'labour/lookups', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('labour')
export class LookupsController {
  constructor(private readonly svc: LabourLookupsService) {}

  @Get()
  all(@CurrentContext() ctx: RequestContext) { return this.svc.getAll(ctx.tenantId).then((data) => ({ data })); }
}
