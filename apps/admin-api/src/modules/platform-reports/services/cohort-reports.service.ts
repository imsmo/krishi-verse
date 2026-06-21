// apps/admin-api/src/modules/platform-reports/services/cohort-reports.service.ts · tenant-growth cohort: new
// tenants per calendar month over a (bounded) window. READ-ONLY aggregate; the window's ≤366-day cap bounds the
// result to ≤13 buckets (no unbounded series). Useful for the exec growth chart.
import { Injectable } from '@nestjs/common';
import { PlatformReportsReadModel } from '../read-models/platform-reports.read-model';
import { resolveWindow } from '../domain/window';
import { QueryTenantGrowthDto } from '../dto/platform-reports.dto';

@Injectable()
export class CohortReportsService {
  constructor(private readonly reads: PlatformReportsReadModel) {}

  async tenantGrowth(dto: QueryTenantGrowthDto) {
    const w = resolveWindow(dto.from, dto.to);
    const buckets = await this.reads.tenantGrowth(w.from, w.to);
    const totalNewTenants = buckets.reduce((acc, b) => acc + b.newTenants, 0);
    return { window: { from: w.from.toISOString(), to: w.to.toISOString() }, bucket: 'month', totalNewTenants, buckets };
  }
}
