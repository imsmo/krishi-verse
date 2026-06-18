// modules/disputes/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every dispute / message / eligibility read+write binds tenant_id (Law 1). No version column →
// mutations lock the row FOR UPDATE; lists are keyset (never OFFSET).
import { DisputeRepository } from '../repositories/dispute.repository';
import { DisputeMessageRepository } from '../repositories/dispute-message.repository';
import { Dispute } from '../domain/dispute.entity';
import { DisputeMessage } from '../domain/dispute-message.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const repo = () => new DisputeRepository(fakeReplica().provider);
const msgRepo = () => new DisputeMessageRepository(fakeReplica().provider);

describe('disputes tenant isolation (SQL contract)', () => {
  it('getForUpdate binds tenant_id + row-locks (no version → FOR UPDATE)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await repo().getForUpdate(tx as any, 'tenantA', 'd1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['d1', 'tenantA']);
  });

  it('insert binds tenant_id and writes no version column', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const d = Dispute.raise({ id: 'd1', tenantId: 'tenantA', orderId: 'o1', raisedBy: 'b1', againstUser: 's1', reasonId: 'r1' });
    await repo().insert(tx as any, d);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO disputes/); expect(sql).not.toMatch(/version/);
    expect(params).toContain('tenantA');
  });

  it('update is tenant-scoped with NO version clause', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const d = Dispute.raise({ id: 'd1', tenantId: 'tenantA', orderId: 'o1', raisedBy: 'b1', againstUser: 's1', reasonId: 'r1' });
    await repo().update(tx as any, d);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id=\$1 AND tenant_id=\$2/); expect(sql).not.toMatch(/version/);
    expect(params[1]).toBe('tenantA');
  });

  it('eligibility insert binds tenant_id + ON CONFLICT(order_id); reason lookup is global', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await repo().insertEligibility(tx as any, 'tenantA', 'o1', 'b1', 's1');
    const [isql, iparams] = tx.query.mock.calls[0];
    expect(isql).toMatch(/INSERT INTO dispute_eligibility/); expect(isql).toMatch(/ON CONFLICT \(order_id\) DO NOTHING/);
    expect(iparams).toEqual(['tenantA', 'o1', 'b1', 's1']);
    const { provider, exec } = fakeReplica();
    await new DisputeRepository(provider).resolveReasonId('tenantA', 'poor_quality');
    const [rsql, rparams] = exec.query.mock.calls[0];
    expect(rsql).toMatch(/type_code='dispute_reason' AND code=\$1 AND tenant_id IS NULL/);
    expect(rparams).toEqual(['poor_quality']);
  });

  it('hasActiveForOrderRaiser binds tenant_id + order_id + raiser over active statuses', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await repo().hasActiveForOrderRaiser(tx as any, 'tenantA', 'o1', 'b1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND order_id=\$2 AND raised_by=\$3/);
    expect(sql).toMatch(/status IN \('open','seller_responded','under_review','escalated'\)/);
    expect(params).toEqual(['tenantA', 'o1', 'b1']);
  });

  it('listFor is keyset (no OFFSET) and tenant-scoped', async () => {
    const { provider, exec } = fakeReplica();
    await new DisputeRepository(provider).listFor('tenantA', { raisedBy: 'b1', limit: 20 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/); expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
    expect(params[0]).toBe('tenantA');
  });

  it('message insert + list bind tenant_id (append-only evidence)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const m = DisputeMessage.create({ id: 'm1', disputeId: 'd1', tenantId: 'tenantA', authorUserId: 'u1', body: 'hi' });
    await msgRepo().insert(tx as any, m);
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO dispute_messages/);
    expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new DisputeMessageRepository(provider).listFor('tenantA', 'd1', { limit: 50 });
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND dispute_id=\$2/); expect(sql).not.toMatch(/OFFSET/i);
    expect(params).toEqual(['tenantA', 'd1', 50]);
  });
});
