// modules/payments/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every payment read/write binds tenant_id (Law 1); the webhook lookup row-locks (FOR UPDATE).
import { PaymentRepository } from '../repositories/payment.repository';
import { CommissionRuleRepository } from '../repositories/commission-rule.repository';
import { SettlementLineRepository } from '../repositories/settlement-line.repository';
import { SettlementStatementRepository } from '../repositories/settlement-statement.repository';
import { TradeInvoiceRepository } from '../repositories/trade-invoice.repository';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('payments tenant isolation (SQL contract)', () => {
  it('getByGatewayOrderForUpdate binds tenant_id and row-locks', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new PaymentRepository(fakeReplica().provider).getByGatewayOrderForUpdate(tx as any, 'tenantA', 'order_x');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND gateway_order_id=\$2/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['tenantA', 'order_x']);
  });

  it('getForUpdate is tenant-scoped + row-locked', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new PaymentRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'p1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['p1', 'tenantA']);
  });

  it('getVisible restricts to owner OR moderator (no cross-user/tenant peeking)', async () => {
    const { provider, exec } = fakeReplica();
    await new PaymentRepository(provider).getVisible('tenantA', 'p1', 'viewer', false);
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$2/);
    expect(sql).toMatch(/\$3=true OR user_id=\$4/);
    expect(params).toEqual(['p1', 'tenantA', false, 'viewer']);
  });

  it('listForUser binds tenant_id + user_id and is keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new PaymentRepository(provider).listForUser('tenantA', 'u1', { limit: 20 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND user_id=\$2/);
    expect(sql).not.toMatch(/OFFSET/i);
    expect(params[0]).toBe('tenantA');
  });

  it('commission resolveBest binds tenant_id (own OR platform-default), effective-dated, most-specific first', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CommissionRuleRepository(fakeReplica().provider).resolveBest(tx as any, { tenantId: 'tenantA', categoryId: null, sellerRoleId: null, source: 'direct' });
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id = \$1 OR tenant_id IS NULL/);
    expect(sql).toMatch(/effective_from <= COALESCE/);
    expect(sql).toMatch(/\(tenant_id IS NOT NULL\) DESC/);   // tenant override beats platform default
    expect(params[0]).toBe('tenantA');
  });

  it('settlement-line aggregate binds tenant_id + seller and locks (FOR UPDATE)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ gross: '0', commission: '0', tax: '0', net: '0', n: 0 }], rowCount: 1 }) };
    await new SettlementLineRepository().aggregateOpenForUpdate(tx as any, 'tenantA', 'sellerX', '2026-04-01', '2026-05-01');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND seller_user_id=\$2 AND statement_id IS NULL/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(params[0]).toBe('tenantA');
  });

  it('statement getVisible is owner-or-moderator scoped (no IDOR)', async () => {
    const { provider, exec } = fakeReplica();
    await new SettlementStatementRepository(provider).getVisible('tenantA', 's1', 'sellerX', false);
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$2 AND \(\$3=true OR seller_user_id=\$4\)/);
    expect(params).toEqual(['s1', 'tenantA', false, 'sellerX']);
  });

  it('trade-invoice getByOrderVisible is buyer/seller/moderator scoped (no IDOR)', async () => {
    const { provider, exec } = fakeReplica();
    await new TradeInvoiceRepository(provider).getByOrderVisible('tenantA', 'o1', 'viewer', false);
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND order_id=\$2 AND \(\$3=true OR buyer_user_id=\$4 OR seller_user_id=\$4\)/);
    expect(params).toEqual(['tenantA', 'o1', false, 'viewer']);
  });
});
