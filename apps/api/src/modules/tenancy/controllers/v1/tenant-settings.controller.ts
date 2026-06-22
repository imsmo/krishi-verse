// modules/tenancy/controllers/v1/tenant-settings.controller.ts · the calling tenant's typed settings + read-only
// feature-overrides + usage dashboard (validate→authorize→delegate). All scoped to ctx.tenantId. Writing a setting
// needs tenant.settings and is type/scope-checked in the domain. Features + usage are READ-ONLY (Law 11 — a tenant
// cannot grant itself features or edit metered usage). Gated by the `tenancy` flag.
import { Controller, Get, Headers, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { TenancyPermissions, tenantActorOf } from '../../policies/tenancy.policies';
import { TenantService } from '../../services/tenant.service';
import { PutTenantSettingSchema, PutTenantSettingDto } from '../../dto/create-tenant-settings.dto';
import { QueryTenantSettingsSchema, QueryTenantSettingsDto } from '../../dto/query-tenant-settings.dto';

const ipOf = (r: Request) => r.ip || null;
const reqKey = (k: string) => { if (!k) throw new BadRequestError('Idempotency-Key header required'); return k; };

@Controller({ path: 'tenant-settings', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('tenancy')
export class TenantSettingsController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryTenantSettingsSchema) q: QueryTenantSettingsDto) {
    return this.tenants.listSettings(ctx.tenantId, q.limit).then((res) => ({ data: res.items }));
  }
  @Put() @RequirePermissions(TenancyPermissions.ManageTenant)
  put(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Headers('idempotency-key') key: string, @ZodBody(PutTenantSettingSchema) dto: PutTenantSettingDto) {
    return this.tenants.putSetting(ctx.tenantId, tenantActorOf(ctx), reqKey(key), dto, ipOf(r)).then((data) => ({ data }));
  }
  @Get('features')
  features(@CurrentContext() ctx: RequestContext) { return this.tenants.listFeatures(ctx.tenantId).then((res) => ({ data: res.items })); }
  @Get('usage')
  usage(@CurrentContext() ctx: RequestContext) { return this.tenants.currentUsage(ctx.tenantId).then((res) => ({ data: res.items })); }
}
