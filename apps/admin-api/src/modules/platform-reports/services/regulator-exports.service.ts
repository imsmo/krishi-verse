// apps/admin-api/src/modules/platform-reports/services/regulator-exports.service.ts · a PII-FREE aggregate snapshot
// for a period (the kind of summary a regulator / board pack needs): GMV + platform take, active tenants, active
// users, and new tenants — counts + money totals only, NO per-user / per-order / PII rows. READ-ONLY; money is
// bigint minor units as strings (Law 2). Generated-at + window stamped for provenance.
import { Injectable } from '@nestjs/common';
import { PlatformReportsReadModel } from '../read-models/platform-reports.read-model';
import { resolveWindow } from '../domain/window';
import { QueryRegulatorDto } from '../dto/platform-reports.dto';

@Injectable()
export class RegulatorExportsService {
  constructor(private readonly reads: PlatformReportsReadModel) {}

  async export(dto: QueryRegulatorDto) {
    const w = resolveWindow(dto.from, dto.to);
    const [tenants, users, gmv, growth] = await Promise.all([
      this.reads.tenantStatusCounts(),
      this.reads.activeUsers(w.from, w.to),
      this.reads.gmv(w.from, w.to, dto.currency),
      this.reads.tenantGrowth(w.from, w.to),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      window: { from: w.from.toISOString(), to: w.to.toISOString() },
      currency: dto.currency,
      piiFree: true,
      metrics: {
        gmvMinor: gmv.gmvMinor,
        platformFeeMinor: gmv.platformFeeMinor,
        commissionMinor: gmv.commissionMinor,
        orders: gmv.orders,
        activeTenants: tenants.activeTotal,
        totalTenants: tenants.total,
        newTenantsInWindow: growth.reduce((acc, b) => acc + b.newTenants, 0),
        activeUsers: users.activeUsers,
      },
    };
  }
}
