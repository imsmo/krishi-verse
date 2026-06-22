// modules/tenancy/repositories/usage-counter.repository.ts · READ-ONLY SQL for usage_counters (0015). tenant_id in
// every query (Law 1) + RLS. Self-serve reads the CURRENT-period counters for the "my usage" dashboard; counters
// are written by the core metering/quota path, never here.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { UsageCounter } from '../domain/usage-counter.entity';

@Injectable()
export class UsageCounterRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Current calendar-month usage counters for the tenant (bounded). */
  async currentPeriodFor(tenantId: string, limit = 500): Promise<UsageCounter[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT tenant_id, metric_code, period, used_value FROM usage_counters
        WHERE tenant_id=$1 AND period = date_trunc('month', now())::date ORDER BY metric_code LIMIT $2`, [tenantId, limit]);
    return r.rows.map((x: any) => UsageCounter.rehydrate({ tenantId: x.tenant_id, metricCode: x.metric_code, period: x.period instanceof Date ? x.period.toISOString().slice(0, 10) : String(x.period), usedValue: BigInt(x.used_value) }));
  }
}
