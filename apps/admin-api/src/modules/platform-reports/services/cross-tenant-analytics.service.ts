// apps/admin-api/src/modules/platform-reports/services/cross-tenant-analytics.service.ts · the exec OVERVIEW: MRR/
// ARR (subscriptions), active-tenant counts by lifecycle status, active users + login success (windowed), and
// headline GMV (windowed). READ-ONLY, anonymised (aggregates only — no per-user/PII rows). Money is bigint minor
// units as strings; the login success ratio is integer basis points (float-free).
import { Injectable } from '@nestjs/common';
import { PlatformReportsReadModel } from '../read-models/platform-reports.read-model';
import { arrMinor, bps, avgOrderValueMinor } from '../domain/metrics';
import { resolveWindow } from '../domain/window';
import { QueryWindowDto } from '../dto/platform-reports.dto';

@Injectable()
export class CrossTenantAnalyticsService {
  constructor(private readonly reads: PlatformReportsReadModel) {}

  async overview(dto: QueryWindowDto) {
    const w = resolveWindow(dto.from, dto.to);
    const [rev, tenants, users, gmv] = await Promise.all([
      this.reads.revenueRollup(dto.currency),
      this.reads.tenantStatusCounts(),
      this.reads.activeUsers(w.from, w.to),
      this.reads.gmv(w.from, w.to, dto.currency),
    ]);
    return {
      window: { from: w.from.toISOString(), to: w.to.toISOString() },
      currency: dto.currency,
      revenue: { mrrMinor: rev.mrrMinor, arrMinor: arrMinor(BigInt(rev.mrrMinor)).toString(), activeSubscriptions: rev.activeSubscriptions },
      tenants: { activeTotal: tenants.activeTotal, total: tenants.total, byStatus: tenants.byStatus },
      activity: { activeUsers: users.activeUsers, loginAttempts: users.loginAttempts, loginSuccessBps: bps(users.loginSucceeded, users.loginAttempts) },
      commerce: { gmvMinor: gmv.gmvMinor, orders: gmv.orders, platformFeeMinor: gmv.platformFeeMinor, avgOrderValueMinor: avgOrderValueMinor(BigInt(gmv.gmvMinor), gmv.orders).toString() },
    };
  }
}
