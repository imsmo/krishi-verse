// apps/admin-api/src/modules/billing-ops/services/revenue-dashboard.service.ts · READ-ONLY revenue rollup for the
// platform billing console: MRR / ARR (active subscriptions normalised to monthly), outstanding receivables
// (issued/partially_paid/overdue invoices), collected-in-window, and invoice counts by status. All money is
// bigint MINOR UNITS surfaced as STRING — never a JS float (Law 2). Reads only; no writes, no money movement.
import { Injectable } from '@nestjs/common';
import { BillingRepository } from '../repositories/billing.repository';
import { arrMinor } from '../domain/revenue';
import { QueryRevenueDto } from '../dto/billing-ops.dto';

@Injectable()
export class RevenueDashboardService {
  constructor(private readonly repo: BillingRepository) {}

  async overview(q: QueryRevenueDto) {
    const r = await this.repo.revenueRollup(q.currency, q.from, q.to);
    return {
      currency: q.currency,
      mrrMinor: r.mrrMinor,
      arrMinor: arrMinor(BigInt(r.mrrMinor)).toString(),
      activeSubscriptions: r.activeSubscriptions,
      outstandingMinor: r.outstandingMinor,
      collectedMinor: r.collectedMinor,
      invoiceStatusCounts: r.statusCounts,
      window: { from: q.from ?? null, to: q.to ?? null },
    };
  }
}
