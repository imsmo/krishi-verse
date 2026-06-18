// modules/tenancy/__tests__/tenant-isolation.spec.ts · SQL contract (CI gate). Subscriptions bind
// tenant_id in EVERY query (Law 1); the GLOBAL plan catalogue has no tenant_id (platform config). No
// version columns → mutations lock FOR UPDATE; lists are keyset (never OFFSET); the expiry finder is
// bounded + SKIP LOCKED.
import { PlanRepository } from '../repositories/plan.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { Plan } from '../domain/plan.entity';
import { Subscription } from '../domain/subscription.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('tenancy tenant isolation (SQL contract)', () => {
  it('plan.insert guards (code, version, country) uniqueness; plans are GLOBAL (no tenant_id)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const p = Plan.create({ id: 'pl1', code: 'growth', defaultName: 'G', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: 0n, annualPriceMinor: 0n, limits: { max_orders_month: 100n } });
    await new PlanRepository(fakeReplica().provider).insert(tx as any, p);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO plans/); expect(sql).toMatch(/ON CONFLICT \(code, version, country_code\) DO NOTHING/);
    expect(sql).not.toMatch(/tenant_id/);   // plans are platform-global
    expect(tx.query.mock.calls.some((c: any[]) => /INSERT INTO plan_limits/.test(c[0]))).toBe(true);   // limits written
  });
  it('plan.getForUpdate locks the row (no tenant filter — global catalogue)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new PlanRepository(fakeReplica().provider).getForUpdate(tx as any, 'pl1');
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/FROM plans WHERE id=\$1 FOR UPDATE/);
  });

  it('subscription.getForUpdate binds tenant_id + FOR UPDATE (no version)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new SubscriptionRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 's1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(sql).not.toMatch(/version=/);
    expect(params).toEqual(['s1', 'tenantA']);
  });
  it('subscription.findLiveForTenant binds tenant_id + live statuses (the one-live + quota lookup)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new SubscriptionRepository(fakeReplica().provider).findLiveForTenant(tx as any, 'tenantA');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND status IN \('trialing','active','past_due','paused'\)/);
    expect(params).toEqual(['tenantA']);
  });
  it('subscription.insert binds tenant_id, no version', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const s = Subscription.subscribe({ id: 's1', tenantId: 'tenantA', planId: 'pl1', billingCycle: 'monthly', priceMinor: 0n, currencyCode: 'INR' });
    await new SubscriptionRepository(fakeReplica().provider).insert(tx as any, s);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO subscriptions/); expect(sql).not.toMatch(/version/); expect(params).toContain('tenantA');
  });
  it('subscription.findDueToExpire is bounded + SKIP LOCKED over live statuses', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new SubscriptionRepository(fakeReplica().provider).findDueToExpire(tx as any, new Date(), 100);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/status IN \('trialing','active','past_due','paused'\) AND current_period_end < \$1::date/);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });
  it('usage read binds tenant_id + current month', async () => {
    const { provider, exec } = fakeReplica();
    await new SubscriptionRepository(provider).readUsage('tenantA');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND period = date_trunc\('month', now\(\)\)::date/);
    expect(params).toEqual(['tenantA']);
  });
});
