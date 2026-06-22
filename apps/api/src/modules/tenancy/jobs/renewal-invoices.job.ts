// modules/tenancy/jobs/renewal-invoices.job.ts
// Worker job (kv_relay): the SaaS RENEWAL BILLING RUN. Finds active subscriptions at/near their period end and
// raises + issues ONE renewal invoice each (the bill the tenant must pay to continue). Claims across tenants,
// bounded per tick; idempotent per (subscription, billing period) so a re-run never double-bills. The invoice's
// line is the subscription's recorded price (bigint minor units) — NO money moves here (collection is god-mode
// billing-ops). NOT a DI provider — apps/worker instantiates it with the kv_relay Pool, mirroring GracePeriodJob.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SaasInvoiceService } from '../services/saas-invoice.service';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const periodTag = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export class RenewalInvoicesJob {
  constructor(private readonly systemPool: Pool, private readonly subs: SubscriptionRepository, private readonly invoices: SaasInvoiceService) {}

  /** `through` defaults to now: bill subscriptions whose period ends on/before it. */
  async run(limit = 200, through: Date = new Date()): Promise<{ raised: number; skipped: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ tenantId: string; subscriptionId: string; priceMinor: bigint; currency: string; periodEnd: Date }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.subs.findDueToRenew(tx, through, limit)).map((s) => { const p = s.toProps(); return { tenantId: p.tenantId, subscriptionId: p.id, priceMinor: p.priceMinor, currency: p.currencyCode, periodEnd: p.currentPeriodEnd }; });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let raised = 0, skipped = 0, failed = 0;
    for (const d of due) {
      try {
        const res = await this.invoices.raiseRenewal({
          tenantId: d.tenantId, subscriptionId: d.subscriptionId, currencyCode: d.currency, taxMinor: 0n,
          dueDate: ymd(d.periodEnd), periodTag: periodTag(d.periodEnd),
          lineItems: [{ desc: 'Subscription renewal', qty: 1, unitMinor: d.priceMinor, totalMinor: d.priceMinor }],
        });
        if (res.raised) raised++; else skipped++;
      } catch { failed++; }
    }
    return { raised, skipped, failed };
  }
}
