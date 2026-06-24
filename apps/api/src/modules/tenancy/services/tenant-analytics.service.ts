// modules/tenancy/services/tenant-analytics.service.ts · resolves the window + delegates to the read model.
import { Injectable } from '@nestjs/common';
import { TenantAnalyticsReadModel, TenantAnalytics } from '../read-models/tenant-analytics.read-model';
import { resolveWindow } from '../domain/analytics-window';

@Injectable()
export class TenantAnalyticsService {
  constructor(private readonly readModel: TenantAnalyticsReadModel) {}
  async summary(tenantId: string, q: { from?: string; to?: string; currency: string }): Promise<TenantAnalytics> {
    const { from, to } = resolveWindow(q.from, q.to);
    return this.readModel.summary(tenantId, from, to, q.currency);
  }
}
