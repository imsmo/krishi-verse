// modules/tenant-integrations/controllers/v1/integrations.controller.ts · the calling tenant's third-party
// integrations (validate→authorize→delegate). All scoped to ctx.tenantId (Law 1). Connect/disconnect need
// tenant.settings (the tenant's own admin — NOT god-mode, Law 11). Gated by the `tenancy` feature flag.
import { Controller, Delete, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { TenancyPermissions, tenantActorOf } from '../../../tenancy/policies/tenancy.policies';
import { TenantIntegrationService } from '../../services/tenant-integration.service';
import { ConnectIntegrationSchema, ConnectIntegrationDto } from '../../dto/connect-integration.dto';

const ipOf = (r: Request) => (r.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || r.ip || null;
const reqKey = (k: string) => { if (!k) throw new BadRequestError('Idempotency-Key header required'); return k; };

@Controller({ path: 'integrations', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('tenancy')
export class IntegrationsController {
  constructor(private readonly integrations: TenantIntegrationService) {}

  /** The provider catalogue a tenant may connect (global, active). */
  @Get('providers')
  providers(@CurrentContext() ctx: RequestContext) { return this.integrations.listProviders(ctx.tenantId).then((data) => ({ data })); }

  /** The tenant's own integrations (masked — no secret ref). */
  @Get()
  list(@CurrentContext() ctx: RequestContext) { return this.integrations.list(ctx.tenantId).then((data) => ({ data })); }

  /** Connect/replace a provider's credentials (vaulted; only the ref is stored). Idempotency-Key required. */
  @Post() @RequirePermissions(TenancyPermissions.ManageTenant)
  connect(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Headers('idempotency-key') key: string, @ZodBody(ConnectIntegrationSchema) dto: ConnectIntegrationDto) {
    reqKey(key);
    return this.integrations.connect(ctx.tenantId, tenantActorOf(ctx), dto, ipOf(r)).then((data) => ({ data }));
  }

  /** Disconnect a provider (deactivate + best-effort vault delete). */
  @Delete(':providerCode') @RequirePermissions(TenancyPermissions.ManageTenant)
  disconnect(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('providerCode') providerCode: string) {
    return this.integrations.disconnect(ctx.tenantId, tenantActorOf(ctx), providerCode, ipOf(r)).then((data) => ({ data }));
  }
}
