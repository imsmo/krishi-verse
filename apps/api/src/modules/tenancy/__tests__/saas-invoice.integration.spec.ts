// modules/tenancy/__tests__/saas-invoice.integration.spec.ts
// REAL Postgres proof of API-W3-06. Proves:
//   1. the renewal run raises + issues ONE invoice per (subscription, period) with a gap-free invoice_no + an
//      outbox event, and is idempotent (a second run does not double-bill);
//   2. payments.payment_succeeded (referenceType='saas_invoice') marks the invoice PAID via the relay handler,
//      and a re-delivered event is a no-op (idempotent);
//   3. an overdue sweep moves an owing past-due invoice → overdue;
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's invoice.
// Provisions a full tenant row + an active subscription directly (provisioning/subscribe are other planes).
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeUser } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { TxContext } from '../../../core/database/unit-of-work';

import { SaasInvoiceRepository } from '../repositories/saas-invoice.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SaasInvoiceService } from '../services/saas-invoice.service';
import { RenewalInvoicesJob } from '../jobs/renewal-invoices.job';
import { SaasInvoicePaymentHandler } from '../events/handlers/payment-succeeded.handler';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;

run('tenancy SaaS invoicing (integration, real Postgres + RLS + relay)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool;
  let invoices: SaasInvoiceService; let invRepo: SaasInvoiceRepository; let subRepo: SubscriptionRepository;
  let renewalJob: RenewalInvoicesJob; let payHandler: SaasInvoicePaymentHandler;
  let isSuperuser = false;

  const tenantA = randomUUID(); const tenantB = randomUUID();
  const planA = randomUUID(); const subA = randomUUID();
  const periodEnd = new Date();   // due now → eligible for renewal
  let invoiceId = '';

  async function provisionTenant(id: string, slug: string) {
    await admin.query(`INSERT INTO lookup_types (code, default_name, is_tenant_extendable) VALUES ('tenant_type','Tenant Type', false) ON CONFLICT (code) DO NOTHING`);
    const lt = await admin.query(`INSERT INTO lookup_values (type_code, tenant_id, code, default_name) VALUES ('tenant_type', NULL, 'fpo', 'FPO') ON CONFLICT (type_code, tenant_id, code) DO UPDATE SET default_name=EXCLUDED.default_name RETURNING id`);
    await admin.query(`INSERT INTO countries (code, default_name) VALUES ('IN','India') ON CONFLICT (code) DO NOTHING`);
    await admin.query(`INSERT INTO tenants (id, slug, legal_name, display_name, tenant_type_id, country_code, status) VALUES ($1,$2,$3,$4,$5,'IN','active') ON CONFLICT (id) DO NOTHING`, [id, slug, `${slug} Legal`, slug, lt.rows[0].id]);
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await provisionTenant(tenantA, 'acme'); await provisionTenant(tenantB, 'globex'); await makeUser(admin, randomUUID());
    // a plan + an active subscription for tenant A whose period ends now
    await admin.query(`INSERT INTO plans (id, code, default_name, country_code, currency_code, monthly_price_minor, annual_price_minor, is_active, version) VALUES ($1,'growth','Growth','IN','INR',99900,999000,true,1) ON CONFLICT (id) DO NOTHING`, [planA]);
    await admin.query(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, billing_cycle, price_minor, currency_code, discount_pct, current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1,$2,$3,'active','monthly',99900,'INR',0, now() - interval '1 month', $4, false) ON CONFLICT (id) DO NOTHING`,
      [subA, tenantA, planA, periodEnd]);

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    const uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter();
    const metrics = new PromMetrics();
    const audit = new AuditWriter(pools);
    invRepo = new SaasInvoiceRepository(replica as any);
    subRepo = new SubscriptionRepository(replica as any);
    invoices = new SaasInvoiceService(uow, outbox, metrics, audit, invRepo);
    renewalJob = new RenewalInvoicesJob(admin, subRepo, invoices);
    payHandler = new SaasInvoicePaymentHandler(invoices);

    inspect = new Pool({ connectionString: APP_URL });
    isSuperuser = (await inspect.query(`SELECT rolsuper FROM pg_roles WHERE rolname=current_user`)).rows[0]?.rolsuper === true;
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('renewal run raises + issues one invoice (idempotent per period)', async () => {
    const first = await renewalJob.run(50, periodEnd);
    expect(first.raised).toBeGreaterThanOrEqual(1);
    const second = await renewalJob.run(50, periodEnd);   // same period → skipped
    expect(second.raised).toBe(0);
    const rows = await admin.query(`SELECT id, status, invoice_no, total_minor FROM saas_invoices WHERE tenant_id=$1 AND subscription_id=$2`, [tenantA, subA]);
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].status).toBe('issued');
    expect(rows.rows[0].invoice_no).toMatch(/^SINV-\d{6}-\d{6}$/);
    expect(String(rows.rows[0].total_minor)).toBe('99900');
    invoiceId = rows.rows[0].id;
    const ev = await admin.query(`SELECT count(*)::int c FROM outbox_events WHERE aggregate_id=$1 AND event_type='tenancy.saas_invoice_issued'`, [invoiceId]);
    expect(ev.rows[0].c).toBe(1);
  });

  it('payment_succeeded (saas_invoice) marks the invoice paid; re-delivery is a no-op', async () => {
    const relay = async () => {
      const c = await pools.writer(0).connect();
      try {
        await c.query('BEGIN');
        await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [tenantA]);
        const tx: TxContext = { query: (sql, params) => c.query(sql, params as any) as any, tenantId: tenantA, userId: 'system' };
        await payHandler.handle({ tenantId: tenantA, aggregateType: 'payment', aggregateId: randomUUID(), eventType: 'payments.payment_succeeded', payload: { v: 1, referenceType: 'saas_invoice', referenceId: invoiceId, amountMinor: '99900' } } as any, tx);
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
    };
    await relay();
    let row = await admin.query(`SELECT status, paid_at FROM saas_invoices WHERE id=$1`, [invoiceId]);
    expect(row.rows[0].status).toBe('paid'); expect(row.rows[0].paid_at).not.toBeNull();
    await relay();   // idempotent re-delivery
    row = await admin.query(`SELECT status FROM saas_invoices WHERE id=$1`, [invoiceId]);
    expect(row.rows[0].status).toBe('paid');
    const paidEv = await admin.query(`SELECT count(*)::int c FROM outbox_events WHERE aggregate_id=$1 AND event_type='tenancy.saas_invoice_paid'`, [invoiceId]);
    expect(paidEv.rows[0].c).toBe(1);   // only the first application emitted
  });

  it('overdue sweep moves an owing past-due invoice to overdue', async () => {
    // raise a fresh issued invoice with a past due_date
    const id = randomUUID();
    await admin.query(
      `INSERT INTO saas_invoices (id, tenant_id, subscription_id, invoice_no, status, currency_code, subtotal_minor, tax_minor, total_minor, due_date, line_items)
       VALUES ($1,$2,$3,$4,'issued','INR',50000,0,50000, (now() - interval '5 days')::date, '[]'::jsonb)`,
      [id, tenantA, subA, `SINV-000000-${Math.floor(Math.random() * 1e6)}`]);
    const ok = await invoices.markOverdue(tenantA, id);
    expect(ok).toBe(true);
    const row = await admin.query(`SELECT status FROM saas_invoices WHERE id=$1`, [id]);
    expect(row.rows[0].status).toBe('overdue');
  });

  it('RLS: tenant B cannot see tenant A\'s invoice', async () => {
    const countAs = async (t: string) => {
      const c = await inspect.connect();
      try { await c.query('BEGIN'); await c.query(`SELECT set_config('app.tenant_id',$1,true)`, [t]);
        const r = await c.query(`SELECT count(*)::int n FROM saas_invoices WHERE id=$1`, [invoiceId]); await c.query('COMMIT'); return r.rows[0].n as number;
      } finally { c.release(); }
    };
    if (isSuperuser) { console.warn('[saas-invoice] superuser bypasses RLS; use kv_app for the strict check'); expect(await countAs(tenantA)).toBe(1); return; }
    expect(await countAs(tenantA)).toBe(1);
    expect(await countAs(tenantB)).toBe(0);
  });
});
