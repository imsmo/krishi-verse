// apps/admin-api/src/modules/platform-reports/platform-reports.module.ts · the god-mode read-only EXEC DASHBOARDS
// plane (Law 11). Cross-tenant aggregates over existing data (subscriptions/orders/tenants/login_events) — MRR/ARR,
// GMV, active tenants, active users, tenant growth, and a PII-free regulator export. Pure reads (no writes, no
// money movement); admin-api's kv_admin bypasses RLS for the platform rollup. Mounts under AdminCoreModule.
import { Module } from '@nestjs/common';
import { PlatformReportsController } from './platform-reports.controller';
import { PlatformReportsReadModel } from './read-models/platform-reports.read-model';
import { CrossTenantAnalyticsService } from './services/cross-tenant-analytics.service';
import { GmvRollupsService } from './services/gmv-rollups.service';
import { CohortReportsService } from './services/cohort-reports.service';
import { RegulatorExportsService } from './services/regulator-exports.service';

@Module({
  controllers: [PlatformReportsController],
  providers: [PlatformReportsReadModel, CrossTenantAnalyticsService, GmvRollupsService, CohortReportsService, RegulatorExportsService],
})
export class PlatformReportsModule {}
