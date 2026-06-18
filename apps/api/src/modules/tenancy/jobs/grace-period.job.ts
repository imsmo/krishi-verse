// modules/tenancy/jobs/grace-period.job.ts
// Worker job (kv_relay): EXPIRE subscriptions past their current_period_end (live → expired) — including
// cancel-at-period-end ones whose end has arrived. Claims across tenants (FOR UPDATE SKIP LOCKED),
// bounded per tick; each expire() is idempotent. NOT a DI provider — instantiated by apps/worker with
// the privileged kv_relay Pool, mirroring the other expiry jobs.
//
// NOTE: it does NOT auto-charge a renewal (SaaS B2B invoicing/collection is the deferred renewal-invoices
// flow). When a subscription expires the tenant's quotas lapse (QuotaService only honours 'active').
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SubscriptionService } from '../services/subscription.service';

export class GracePeriodJob {
  constructor(private readonly systemPool: Pool, private readonly repo: SubscriptionRepository, private readonly subscriptions: SubscriptionService) {}

  async run(limit = 200): Promise<{ expired: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.repo.findDueToExpire(tx, new Date(), limit)).map((s) => ({ id: s.id, tenantId: s.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let expired = 0, failed = 0;
    for (const d of due) { try { await this.subscriptions.expire(d.tenantId, d.id); expired++; } catch { failed++; } }
    return { expired, failed };
  }
}
