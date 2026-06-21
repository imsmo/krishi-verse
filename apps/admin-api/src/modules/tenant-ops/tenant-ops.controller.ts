// apps/admin-api/src/modules/tenant-ops/tenant-ops.controller.ts · god-mode tenant lifecycle surface (Law 11).
// Every route: AdminAuthGuard + OwnerPermissionsGuard. MUTATIONS (approve/suspend/archive/limit-override)
// additionally require HardwareKeyGuard (FIDO2) + StepUpReauthGuard (recent re-auth) — JIT elevation for
// consequential platform changes. validate (zod) → authorize (owner perm) → delegate. No business logic here.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { TenantSearchService } from './services/tenant-search.service';
import { TenantScorecardService } from './services/tenant-scorecard.service';
import { ApproveTenantService } from './services/approve-tenant.service';
import { SuspendTenantService } from './services/suspend-tenant.service';
import { ArchiveTenantService } from './services/archive-tenant.service';
import { OverrideLimitsService } from './services/override-limits.service';
import {
  QueryTenantsSchema, QueryTenantsDto, ApproveTenantSchema, ApproveTenantDto, SuspendTenantSchema, SuspendTenantDto,
  ArchiveTenantSchema, ArchiveTenantDto, OverrideLimitSchema, OverrideLimitDto,
} from './dto/tenant-ops.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'tenants', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class TenantOpsController {
  constructor(
    private readonly search: TenantSearchService,
    private readonly scorecard: TenantScorecardService,
    private readonly approveSvc: ApproveTenantService,
    private readonly suspendSvc: SuspendTenantService,
    private readonly archiveSvc: ArchiveTenantService,
    private readonly limits: OverrideLimitsService,
  ) {}

  @Get() @RequireOwnerPermission(OwnerPermissions.TenantRead)
  list(@ZodQuery(QueryTenantsSchema) q: QueryTenantsDto) {
    return this.search.search({ q: q.q, status: q.status, riskMin: q.riskMin, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id') @RequireOwnerPermission(OwnerPermissions.TenantRead)
  get(@Param('id') id: string) { return this.scorecard.scorecard(id).then((data) => ({ data })); }

  // ---- mutations: hardware-key + step-up elevation required ----
  @Post(':id/approve') @RequireOwnerPermission(OwnerPermissions.TenantManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  approve(@Req() req: any, @Param('id') id: string, @ZodBody(ApproveTenantSchema) dto: ApproveTenantDto) {
    return this.approveSvc.approve(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post(':id/suspend') @RequireOwnerPermission(OwnerPermissions.TenantManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  suspend(@Req() req: any, @Param('id') id: string, @ZodBody(SuspendTenantSchema) dto: SuspendTenantDto) {
    return this.suspendSvc.suspend(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post(':id/archive') @RequireOwnerPermission(OwnerPermissions.TenantManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  archive(@Req() req: any, @Param('id') id: string, @ZodBody(ArchiveTenantSchema) dto: ArchiveTenantDto) {
    return this.archiveSvc.archive(admin(req), id, dto).then((data) => ({ data }));
  }
  @Patch(':id/limits') @RequireOwnerPermission(OwnerPermissions.TenantManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  overrideLimit(@Req() req: any, @Param('id') id: string, @ZodBody(OverrideLimitSchema) dto: OverrideLimitDto) {
    return this.limits.override(admin(req), id, dto).then((data) => ({ data }));
  }
}
