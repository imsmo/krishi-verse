// apps/admin-api/src/modules/tenant-ops/__tests__/impersonation-audit.spec.ts · the AUDIT-IN-TX gate for
// tenant-ops state changes: a god-mode lifecycle action MUST write its status-event AND its audit_log row on
// the SAME client (one ACID tx, Law 4 / §4) — and write NOTHING when the transition is rejected. (Impersonation
// itself is a separate module; this asserts the shared in-tx audit invariant that every tenant-ops write upholds.)
import { SuspendTenantService } from '../services/suspend-tenant.service';
import { Tenant } from '../domain/tenant.entity';
import { IllegalTenantTransitionError } from '../domain/tenant.state';

const actor = { userId: 'admin1', roles: ['platform_tenant_ops'], ip: '10.0.0.1', requestId: 'req1' } as any;

describe('tenant-ops audit-in-tx invariant', () => {
  it('suspend writes the status-event + audit row on the SAME tx client, in order', async () => {
    const client = { id: 'tx-client' };
    const order: string[] = [];
    const pool = { withTx: async (fn: any) => fn(client) } as any;
    const audit = { write: jest.fn(async (c: any) => { expect(c).toBe(client); order.push('audit'); }) } as any;
    const repo = {
      getForUpdate: jest.fn(async (c: any) => { expect(c).toBe(client); order.push('lock'); return Tenant.rehydrate({ id: 't1', slug: 'acme', status: 'active', riskScore: 0, approvedAt: null }); }),
      updateStatus: jest.fn(async (c: any) => { expect(c).toBe(client); order.push('update'); }),
      insertStatusEvent: jest.fn(async (c: any) => { expect(c).toBe(client); order.push('status_event'); }),
    } as any;

    await new SuspendTenantService(pool, audit, repo).suspend(actor, 't1', { reason: 'billing failure' });
    expect(order).toEqual(['lock', 'update', 'status_event', 'audit']);   // all in-tx, audit last
  });

  it('an illegal transition writes NEITHER a status-event NOR an audit row (atomic rollback)', async () => {
    const pool = { withTx: async (fn: any) => fn({}) } as any;
    const audit = { write: jest.fn() } as any;
    const repo = {
      getForUpdate: jest.fn(async () => Tenant.rehydrate({ id: 't1', slug: 'acme', status: 'archived', riskScore: 0, approvedAt: null })),
      updateStatus: jest.fn(), insertStatusEvent: jest.fn(),
    } as any;
    await expect(new SuspendTenantService(pool, audit, repo).suspend(actor, 't1', { reason: 'x' + 'yz' })).rejects.toBeInstanceOf(IllegalTenantTransitionError);
    expect(repo.insertStatusEvent).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
});
