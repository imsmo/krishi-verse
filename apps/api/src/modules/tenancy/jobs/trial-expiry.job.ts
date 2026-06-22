// modules/tenancy/jobs/trial-expiry.job.ts
// Worker job (kv_relay): find trialing subscriptions whose trial ends within a notice window and emit ONE
// tenancy.trial_ending event each (→ notifications nudge the tenant to add a plan/payment method before they
// lose access). Read + the emits commit in ONE tx; idempotent per (subscription, trial-end day) via a
// deterministic event de-dupe key in the payload (consumers de-dupe). Bounded per tick, cross-tenant. NOT a DI
// provider — apps/worker instantiates it with the kv_relay Pool.
import type { Pool, PoolClient } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { TenancyEventType } from '../domain/tenancy.events';

export class TrialExpiryJob {
  constructor(private readonly systemPool: Pool, private readonly subs: SubscriptionRepository) {}

  /** `noticeDays` ahead of trial end to nudge; defaults to 3. */
  async run(limit = 200, noticeDays = 3, now: Date = new Date()): Promise<{ notified: number }> {
    const through = new Date(now.getTime() + noticeDays * 86400_000);
    const client: PoolClient = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      const ending = await this.subs.findTrialsEnding(tx, through, limit);
      let notified = 0;
      for (const s of ending) {
        const p = s.toProps();
        const dayTag = p.currentPeriodEnd.toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1,'subscription',$2,$3,$4::jsonb)`,
          [p.tenantId, p.id, TenancyEventType.TrialEnding, JSON.stringify({ v: 1, subscriptionId: p.id, tenantId: p.tenantId, trialEndsOn: dayTag, dedupeKey: `trial_ending:${p.id}:${dayTag}` })]);
        notified++;
      }
      await client.query('COMMIT');
      return { notified };
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
