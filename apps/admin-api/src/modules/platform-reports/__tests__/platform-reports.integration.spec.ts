// apps/admin-api/src/modules/platform-reports/__tests__/platform-reports.integration.spec.ts
// REAL proof against a live Postgres (the schema apps/api builds). The exec dashboards are CROSS-TENANT aggregates
// run as kv_admin (RLS bypassed — the god-mode reporting plane); this asserts every aggregate SQL is valid, the
// windowed queries run (partition-pruned on orders/login_events.created_at), and money comes back as bigint
// minor-unit STRINGS while counts come back as numbers. Runs only when DATABASE_ADMIN_URL is set (CI's DB job).
import { AdminConfig } from '../../../core/config/admin-config';
import { AdminPool } from '../../../core/database/admin-pool';
import { PlatformReportsReadModel } from '../read-models/platform-reports.read-model';
import { CrossTenantAnalyticsService } from '../services/cross-tenant-analytics.service';
import { GmvRollupsService } from '../services/gmv-rollups.service';
import { CohortReportsService } from '../services/cohort-reports.service';
import { RegulatorExportsService } from '../services/regulator-exports.service';

const APP_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const run = APP_URL ? describe : describe.skip;

run('platform-reports (integration, real Postgres — cross-tenant aggregates)', () => {
  let pool: AdminPool; let reads: PlatformReportsReadModel;
  let analytics: CrossTenantAnalyticsService; let gmv: GmvRollupsService; let cohorts: CohortReportsService; let regulator: RegulatorExportsService;

  beforeAll(async () => {
    const config = new AdminConfig({ NODE_ENV: 'test', DATABASE_ADMIN_URL: APP_URL, ADMIN_JWT_SECRET: 's'.repeat(40) });
    pool = new AdminPool(config);
    reads = new PlatformReportsReadModel(pool);
    analytics = new CrossTenantAnalyticsService(reads);
    gmv = new GmvRollupsService(reads);
    cohorts = new CohortReportsService(reads);
    regulator = new RegulatorExportsService(reads);
  }, 30000);

  afterAll(async () => { await pool?.onModuleDestroy(); });

  it('overview: every aggregate SQL runs; money is string, counts are numbers (cross-tenant)', async () => {
    const o: any = await analytics.overview({ currency: 'INR' } as any);
    expect(typeof o.revenue.mrrMinor).toBe('string');
    expect(typeof o.revenue.arrMinor).toBe('string');
    expect(typeof o.tenants.total).toBe('number');
    expect(typeof o.activity.activeUsers).toBe('number');
    expect(typeof o.activity.loginSuccessBps).toBe('number');
    expect(typeof o.commerce.gmvMinor).toBe('string');
    expect(/^[0-9]+$/.test(o.commerce.gmvMinor)).toBe(true);          // pure integer minor units, never a float
  });

  it('gmv + tenant-growth + regulator export all execute + shape-check', async () => {
    const g: any = await gmv.gmv({ currency: 'INR' } as any);
    expect(/^[0-9]+$/.test(g.gmvMinor)).toBe(true);
    expect(typeof g.orders).toBe('number');

    const tg: any = await cohorts.tenantGrowth({} as any);
    expect(Array.isArray(tg.buckets)).toBe(true);
    expect(typeof tg.totalNewTenants).toBe('number');

    const reg: any = await regulator.export({ currency: 'INR' } as any);
    expect(reg.piiFree).toBe(true);
    expect(/^[0-9]+$/.test(reg.metrics.gmvMinor)).toBe(true);
    expect(typeof reg.metrics.activeTenants).toBe('number');
  });
});
