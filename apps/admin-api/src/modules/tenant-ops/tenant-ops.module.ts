// apps/admin-api/src/modules/tenant-ops/tenant-ops.module.ts · the god-mode TENANT lifecycle module (Law 11).
// Owns the platform-driven tenant lifecycle WRITE path — approve / suspend / archive + per-tenant numeric limit
// overrides — plus tenant search + scorecard reads. The tenant API can request onboarding, but only this plane
// approves/suspends/archives. Mounts under AdminCoreModule (auth/RBAC/FIDO2/step-up/audit are @Global).
import { Module } from '@nestjs/common';
import { TenantOpsController } from './tenant-ops.controller';
import { TenantRepository } from './repositories/tenant.repository';
import { TenantSearchService } from './services/tenant-search.service';
import { TenantScorecardService } from './services/tenant-scorecard.service';
import { ApproveTenantService } from './services/approve-tenant.service';
import { SuspendTenantService } from './services/suspend-tenant.service';
import { ArchiveTenantService } from './services/archive-tenant.service';
import { OverrideLimitsService } from './services/override-limits.service';

@Module({
  controllers: [TenantOpsController],
  providers: [
    TenantRepository,
    TenantSearchService, TenantScorecardService,
    ApproveTenantService, SuspendTenantService, ArchiveTenantService, OverrideLimitsService,
  ],
})
export class TenantOpsModule {}
