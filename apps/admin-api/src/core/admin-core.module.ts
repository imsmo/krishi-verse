// apps/admin-api/src/core/admin-core.module.ts · the @Global core of the god-mode realm: config, the kv_admin
// pool, admin-JWT auth + owner RBAC guards, the FIDO2/step-up elevation guards, and the in-tx audit writer.
// Global so every ops module's controllers can resolve the guards (@UseGuards) and inject the pool/audit without
// re-importing. Mirrors apps/api's CoreModule pattern.
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminConfig } from './config/admin-config';
import { AdminPool } from './database/admin-pool';
import { AdminAuditWriter } from './audit/admin-audit.writer';
import { AdminAuditInterceptor } from './audit/admin-audit.interceptor';
import { AdminAuthGuard } from './auth/admin-auth.guard';
import { HardwareKeyGuard } from './auth/hardware-key.guard';
import { StepUpReauthGuard } from './auth/step-up-reauth.guard';
import { OwnerPermissionsGuard } from './rbac/owner-roles';
import { IpAllowlistMiddleware } from './auth/ip-allowlist.middleware';

@Global()
@Module({
  providers: [
    AdminConfig, AdminPool, AdminAuditWriter, IpAllowlistMiddleware,
    AdminAuthGuard, HardwareKeyGuard, StepUpReauthGuard, OwnerPermissionsGuard,
    { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor },
  ],
  exports: [AdminConfig, AdminPool, AdminAuditWriter, IpAllowlistMiddleware, AdminAuthGuard, HardwareKeyGuard, StepUpReauthGuard, OwnerPermissionsGuard],
})
export class AdminCoreModule {}
