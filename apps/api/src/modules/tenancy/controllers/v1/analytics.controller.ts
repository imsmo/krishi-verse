// modules/tenancy/controllers/v1/analytics.controller.ts · the calling tenant's analytics dashboard.
// Read-only; ALWAYS scoped to ctx.tenantId (the tenant sees only its own figures — no cross-tenant, Law 11).
// Needs tenant.settings (a tenant admin). Gated by the `tenancy` flag.
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { TenancyPermissions } from '../../policies/tenancy.policies';
import { TenantAnalyticsService } from '../../services/tenant-analytics.service';
import { QueryAnalyticsSchema, QueryAnalyticsDto } from '../../dto/query-analytics.dto';

@Controller({ path: 'tenancy/analytics', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('tenancy')
export class AnalyticsController {
  constructor(private readonly analytics: TenantAnalyticsService) {}

  @Get() @RequirePermissions(TenancyPermissions.ManageTenant)
  summary(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAnalyticsSchema) q: QueryAnalyticsDto) {
    return this.analytics.summary(ctx.tenantId, { from: q.from, to: q.to, currency: q.currency }).then((data) => ({ data }));
  }
}
