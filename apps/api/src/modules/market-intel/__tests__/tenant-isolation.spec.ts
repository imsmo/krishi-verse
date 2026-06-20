// modules/market-intel/__tests__/tenant-isolation.spec.ts · scoping SQL contract (CI gate).
// price_alerts (tenant-scoped) bind tenant_id + lock FOR UPDATE; matchActive uses FOR UPDATE SKIP LOCKED; lists
// are keyset (no OFFSET). mandi_prices/predictions are GLOBAL (no tenant_id) but bound product_id (partition
// prune) and order by the partition key DESC; the user inbox of alerts is filtered by user_id.
import { PriceAlertRepository } from '../repositories/price-alert.repository';
import { MandiPriceRepository } from '../repositories/mandi-price.repository';
import { PricePredictionRepository } from '../repositories/price-prediction.repository';
import { PriceAlert } from '../domain/price-alert.entity';
import { MandiPrice } from '../domain/mandi-price.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const alert = () => PriceAlert.create({ id: 'a1', tenantId: 'tenantA', userId: 'u1', productId: 'p1', regionId: 'r1', direction: 'above', thresholdMinor: 250000n });

describe('price_alerts isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE; insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new PriceAlertRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'a1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/); expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const tx2 = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new PriceAlertRepository(fakeReplica().provider).insert(tx2 as any, alert());
    expect(tx2.query.mock.calls[0][0]).toMatch(/INSERT INTO price_alerts/); expect(tx2.query.mock.calls[0][1]).toContain('tenantA');
  });
  it('matchActive binds tenant_id + product + FOR UPDATE SKIP LOCKED', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new PriceAlertRepository(fakeReplica().provider).matchActive(tx as any, 'tenantA', 'p1', 'r1');
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND product_id=\$2/); expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });
  it('user list binds user_id; keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new PriceAlertRepository(provider).listForUser('tenantA', 'u1', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1 AND user_id=\$2/); expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('mandi_prices (global, partitioned)', () => {
  it('history bounds product_id + orders by price_date DESC (partition prune); keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new MandiPriceRepository(provider).listFor('tenantA', { productId: 'p1', limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/product_id=\$1/); expect(sql).toMatch(/ORDER BY price_date DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
  it('insert targets mandi_prices (no tenant_id column — global)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const m = MandiPrice.observe({ mandiId: null, regionId: 'r1', productId: 'p1', gradeOptionId: null, priceDate: '2026-06-20', minMinor: null, maxMinor: null, modalMinor: 250000n, unitCode: 'quintal', arrivalsQty: null, source: 'agmarknet', currencyCode: 'INR' });
    await new MandiPriceRepository(fakeReplica().provider).insert(tx as any, m);
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO mandi_prices/); expect(tx.query.mock.calls[0][0]).not.toMatch(/tenant_id/);
  });
});

describe('price_predictions (global, partitioned)', () => {
  it('latest bounds product+region, orders created_at DESC', async () => {
    const { provider, exec } = fakeReplica();
    await new PricePredictionRepository(provider).latest('tenantA', 'p1', 'r1');
    expect(exec.query.mock.calls[0][0]).toMatch(/product_id=\$1 AND region_id=\$2/); expect(exec.query.mock.calls[0][0]).toMatch(/ORDER BY created_at DESC/);
  });
});
