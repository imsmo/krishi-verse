// apps/admin-api/src/modules/platform-reports/__tests__/platform-reports.spec.ts · unit tests (pure/mocked).
// Covers: the FLOAT-FREE metric math (MRR normalisation, ARR, basis-point ratios, avg order value); the report
// window validation (forward + bounded); owner-RBAC for the reports role + no-escalation/no-'*' (Law 11); DTO
// validation; and the services composing the read-model into the exec views (money stays bigint-string, ratios
// stay integer bps).
import { monthlyMinor, arrMinor, sumMrr, bps, avgOrderValueMinor } from '../domain/metrics';
import { resolveWindow, MAX_WINDOW_DAYS } from '../domain/window';
import { InvalidWindowError } from '../domain/platform-reports.errors';
import { CrossTenantAnalyticsService } from '../services/cross-tenant-analytics.service';
import { GmvRollupsService } from '../services/gmv-rollups.service';
import { RegulatorExportsService } from '../services/regulator-exports.service';
import { QueryWindowSchema, QueryGmvSchema, QueryRegulatorSchema } from '../dto/platform-reports.dto';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';

describe('metric math (float-free)', () => {
  it('monthly normalisation (annual÷12 floor), ARR, sumMrr — all bigint', () => {
    expect(monthlyMinor('annual', 1200000n)).toBe(100000n);
    expect(monthlyMinor('monthly', 99900n)).toBe(99900n);
    expect(monthlyMinor('annual', 100n)).toBe(8n);
    expect(arrMinor(100000n)).toBe(1200000n);
    expect(sumMrr([{ cycle: 'monthly', priceMinor: 100000n }, { cycle: 'annual', priceMinor: 1200000n }])).toBe(200000n);
  });
  it('ratios are integer basis points; division-by-zero safe', () => {
    expect(bps(95, 100)).toBe(9500);          // 95% = 9500 bps
    expect(bps(1, 3)).toBe(3333);             // floor, never a float
    expect(bps(5, 0)).toBe(0);
  });
  it('avg order value is floor bigint; zero orders ⇒ 0', () => {
    expect(avgOrderValueMinor(100000n, 3)).toBe(33333n);
    expect(avgOrderValueMinor(100000n, 0)).toBe(0n);
  });
});

describe('report window', () => {
  it('defaults to last 30 days; rejects backwards + oversized + invalid', () => {
    const now = new Date('2026-06-21T00:00:00Z');
    const w = resolveWindow(undefined, undefined, now);
    expect(w.to.getTime()).toBe(now.getTime());
    expect(now.getTime() - w.from.getTime()).toBe(30 * 86_400_000);
    expect(() => resolveWindow('2026-06-21T00:00:00Z', '2026-06-01T00:00:00Z', now)).toThrow(InvalidWindowError);   // backwards
    expect(() => resolveWindow('2020-01-01T00:00:00Z', '2026-06-21T00:00:00Z', now)).toThrow(InvalidWindowError);   // > max
    expect(() => resolveWindow('not-a-date', undefined, now)).toThrow(InvalidWindowError);
    expect(MAX_WINDOW_DAYS).toBe(366);
  });
});

describe('owner roles for reports', () => {
  it('reports_viewer has read only; never manage/money/god; tenant roles NOTHING; no *', () => {
    const v = resolveOwnerPermissions(['platform_reports_viewer']);
    expect(hasOwnerPermission(v, OwnerPermissions.ReportsRead)).toBe(true);
    expect(v.has('*')).toBe(false);
    expect(hasOwnerPermission(v, OwnerPermissions.BillingManage)).toBe(false);
    expect(hasOwnerPermission(v, OwnerPermissions.SupportOversightManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['tenant_admin']), OwnerPermissions.ReportsRead)).toBe(false);
  });
});

describe('dto validation', () => {
  it('window/gmv/regulator: currency default + iso + uuid; reject unknown keys + bad iso', () => {
    expect(QueryWindowSchema.safeParse({}).success).toBe(true);                                  // all optional
    const p = QueryWindowSchema.safeParse({}); if (p.success) expect(p.data.currency).toBe('INR');
    expect(QueryGmvSchema.safeParse({ tenantId: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
    expect(QueryGmvSchema.safeParse({ tenantId: 'nope' }).success).toBe(false);
    expect(QueryWindowSchema.safeParse({ from: 'not-iso' }).success).toBe(false);
    expect(QueryRegulatorSchema.safeParse({ evil: 1 }).success).toBe(false);
  });
});

describe('services compose the read-model (money bigint-string, ratios bps)', () => {
  it('overview: MRR/ARR + tenants + activity bps + GMV/avg', async () => {
    const reads = {
      revenueRollup: jest.fn(async () => ({ mrrMinor: '500000', activeSubscriptions: 3 })),
      tenantStatusCounts: jest.fn(async () => ({ byStatus: { active: 4, suspended: 1 }, activeTotal: 4, total: 5 })),
      activeUsers: jest.fn(async () => ({ activeUsers: 120, loginAttempts: 200, loginSucceeded: 190 })),
      gmv: jest.fn(async () => ({ gmvMinor: '900000', platformFeeMinor: '9000', commissionMinor: '18000', orders: 3 })),
    } as any;
    const out: any = await new CrossTenantAnalyticsService(reads).overview({ currency: 'INR' } as any);
    expect(out.revenue.arrMinor).toBe('6000000');                 // 500000 * 12
    expect(out.activity.loginSuccessBps).toBe(bps(190, 200));     // 9500
    expect(out.commerce.avgOrderValueMinor).toBe('300000');       // 900000 / 3
    expect(out.tenants.activeTotal).toBe(4);
  });
  it('gmv: passes window + tenant filter, returns avg', async () => {
    const reads = { gmv: jest.fn(async () => ({ gmvMinor: '1000', platformFeeMinor: '10', commissionMinor: '20', orders: 2 })) } as any;
    const out: any = await new GmvRollupsService(reads).gmv({ currency: 'INR', tenantId: '11111111-1111-1111-1111-111111111111' } as any);
    expect(out.avgOrderValueMinor).toBe('500');
    expect(reads.gmv).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'INR', '11111111-1111-1111-1111-111111111111');
  });
  it('regulator export is PII-free + stamps generatedAt/window', async () => {
    const reads = {
      tenantStatusCounts: jest.fn(async () => ({ byStatus: {}, activeTotal: 2, total: 2 })),
      activeUsers: jest.fn(async () => ({ activeUsers: 10, loginAttempts: 10, loginSucceeded: 10 })),
      gmv: jest.fn(async () => ({ gmvMinor: '5000', platformFeeMinor: '50', commissionMinor: '100', orders: 4 })),
      tenantGrowth: jest.fn(async () => [{ period: '2026-06', newTenants: 1 }]),
    } as any;
    const out: any = await new RegulatorExportsService(reads).export({ currency: 'INR' } as any);
    expect(out.piiFree).toBe(true);
    expect(out.metrics.gmvMinor).toBe('5000');
    expect(out.metrics.newTenantsInWindow).toBe(1);
    expect(typeof out.generatedAt).toBe('string');
  });
});
