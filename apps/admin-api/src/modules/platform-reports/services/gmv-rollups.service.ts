// apps/admin-api/src/modules/platform-reports/services/gmv-rollups.service.ts · GMV rollup over orders in a window
// (cross-tenant, or filtered to one tenant): gross merchandise value, platform fee + commission take, order count,
// and average order value. READ-ONLY; money is bigint minor units as strings (Law 2). The window is bounded
// (≤366d) and filters created_at so PG prunes the partitioned orders table.
import { Injectable } from '@nestjs/common';
import { PlatformReportsReadModel } from '../read-models/platform-reports.read-model';
import { avgOrderValueMinor } from '../domain/metrics';
import { resolveWindow } from '../domain/window';
import { QueryGmvDto } from '../dto/platform-reports.dto';

@Injectable()
export class GmvRollupsService {
  constructor(private readonly reads: PlatformReportsReadModel) {}

  async gmv(dto: QueryGmvDto) {
    const w = resolveWindow(dto.from, dto.to);
    const g = await this.reads.gmv(w.from, w.to, dto.currency, dto.tenantId);
    return {
      window: { from: w.from.toISOString(), to: w.to.toISOString() },
      currency: dto.currency,
      tenantId: dto.tenantId ?? null,
      gmvMinor: g.gmvMinor,
      platformFeeMinor: g.platformFeeMinor,
      commissionMinor: g.commissionMinor,
      orders: g.orders,
      avgOrderValueMinor: avgOrderValueMinor(BigInt(g.gmvMinor), g.orders).toString(),
    };
  }
}
