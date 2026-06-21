// apps/admin-api/src/modules/providers-ops/providers-ops.controller.ts · god-mode integration-provider registry
// (Law 11 + Law 12). Every route: AdminAuthGuard + OwnerPermissionsGuard. Reads need providers.read; the one
// MUTATION (enable/disable — affects payments/comm platform-wide) needs providers.manage + HardwareKeyGuard
// (FIDO2) + StepUpReauthGuard. validate (zod) → authorize → delegate ONLY. Never returns secret material — only
// the registry + credential-ref health counts. Static routes (health/financial) are declared BEFORE :code.
import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { IntegrationProvidersAdminService } from './services/integration-providers-admin.service';
import { ProviderSlaMonitorService } from './services/provider-sla-monitor.service';
import { FinancialPartnersAdminService } from './services/financial-partners-admin.service';
import { QueryProvidersSchema, QueryProvidersDto, QueryChangesSchema, QueryChangesDto, ToggleProviderSchema, ToggleProviderDto } from './dto/providers-ops.dto';

const decodeCodeCursor = (c?: string) => (c ? { code: Buffer.from(c, 'base64').toString() } : undefined);
const decodeChangeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'providers', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class ProvidersOpsController {
  constructor(
    private readonly providers: IntegrationProvidersAdminService,
    private readonly monitor: ProviderSlaMonitorService,
    private readonly financial: FinancialPartnersAdminService,
  ) {}

  // ---- reads (static routes first) ----
  @Get('health') @RequireOwnerPermission(OwnerPermissions.ProvidersRead)
  health() { return this.monitor.healthRollup().then((res) => ({ data: res.items })); }

  @Get('financial') @RequireOwnerPermission(OwnerPermissions.ProvidersRead)
  financialPartners() { return this.financial.list().then((res) => ({ data: res.items })); }

  @Get() @RequireOwnerPermission(OwnerPermissions.ProvidersRead)
  list(@ZodQuery(QueryProvidersSchema) q: QueryProvidersDto) {
    return this.providers.list({ category: q.category, isActive: q.isActive === undefined ? undefined : q.isActive === 'true', cursor: decodeCodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':code') @RequireOwnerPermission(OwnerPermissions.ProvidersRead)
  get(@Param('code') code: string) { return this.providers.get(code).then((data) => ({ data })); }

  @Get(':code/history') @RequireOwnerPermission(OwnerPermissions.ProvidersRead)
  history(@Param('code') code: string, @ZodQuery(QueryChangesSchema) q: QueryChangesDto) {
    return this.providers.history({ providerCode: code, cursor: decodeChangeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  // ---- mutation: enable/disable → manage perm + FIDO2 + step-up ----
  @Patch(':code') @RequireOwnerPermission(OwnerPermissions.ProvidersManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  toggle(@Req() req: any, @Param('code') code: string, @ZodBody(ToggleProviderSchema) dto: ToggleProviderDto) {
    return this.providers.toggle(admin(req), code, dto).then((data) => ({ data }));
  }
}
