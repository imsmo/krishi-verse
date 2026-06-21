// apps/admin-api/src/modules/providers-ops/providers-ops.module.ts · the god-mode INTEGRATION-PROVIDER registry
// plane (Law 11 + Law 12). Owns the global integration_providers registry: enable/disable a provider platform-wide
// (pull a failing PSP/SMS/KYC provider out of rotation so dependents degrade gracefully) + read the registry,
// credential-ref health (counts only — never secrets), the financial-partners lens, and change history. Mounts
// under AdminCoreModule (auth/RBAC/FIDO2/step-up/audit @Global).
import { Module } from '@nestjs/common';
import { ProvidersOpsController } from './providers-ops.controller';
import { ProvidersRepository } from './repositories/providers.repository';
import { IntegrationProvidersAdminService } from './services/integration-providers-admin.service';
import { ProviderSlaMonitorService } from './services/provider-sla-monitor.service';
import { FinancialPartnersAdminService } from './services/financial-partners-admin.service';

@Module({
  controllers: [ProvidersOpsController],
  providers: [ProvidersRepository, IntegrationProvidersAdminService, ProviderSlaMonitorService, FinancialPartnersAdminService],
})
export class ProvidersOpsModule {}
