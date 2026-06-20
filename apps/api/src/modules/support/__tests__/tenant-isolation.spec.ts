// modules/support/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every ticket read/write binds tenant_id; getForUpdate locks FOR UPDATE; lists are keyset (never OFFSET);
// the queue box excludes resolved/closed; existsByTicketNo backs idempotent auto-open.
import { SupportTicketRepository } from '../repositories/support-ticket.repository';
import { SupportTicket } from '../domain/support-ticket.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }
const ticket = () => SupportTicket.open({ id: 't1', tenantId: 'tenantA', ticketNo: 'KV-T-1', requesterUserId: 'u1', channel: 'app', categoryId: null, severity: 'P2', subject: 'help', conversationId: null });

describe('support_tickets isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new SupportTicketRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 't1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['t1', 'tenantA']);
  });
  it('insert binds tenant_id; list keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    await new SupportTicketRepository(fakeReplica().provider).insert(tx as any, ticket());
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO support_tickets/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new SupportTicketRepository(provider).listFor('tenantA', { box: 'mine', requesterUserId: 'u1', limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1/); expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
  it('queue box excludes resolved/closed', async () => {
    const { provider, exec } = fakeReplica();
    await new SupportTicketRepository(provider).listFor('tenantA', { box: 'queue', limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/status NOT IN \('resolved','closed'\)/);
  });
  it('existsByTicketNo checks the unique ticket_no (idempotent auto-open)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new SupportTicketRepository(fakeReplica().provider).existsByTicketNo(tx as any, 'DSP-XYZ');
    expect(tx.query.mock.calls[0][0]).toMatch(/WHERE ticket_no=\$1/);
  });
});
