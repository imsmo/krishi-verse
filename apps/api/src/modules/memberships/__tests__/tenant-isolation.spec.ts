// modules/memberships/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every tier/membership read+write binds tenant_id (Law 1). Platform-standard (NULL) tiers are visible
// but NOT mutable via the tenant API (Law 11). No version columns → mutations lock FOR UPDATE; lists are
// keyset (never OFFSET); the expiry finder is bounded + SKIP LOCKED.
import { MembershipTierRepository } from '../repositories/membership-tier.repository';
import { UserMembershipRepository } from '../repositories/user-membership.repository';
import { MembershipTier, parseBenefits } from '../domain/membership-tier.entity';
import { UserMembership } from '../domain/user-membership.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('memberships tenant isolation (SQL contract)', () => {
  it('tier.getForUpdate locks a TENANT-OWNED tier only (global tiers not mutable here — Law 11)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new MembershipTierRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 't1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(sql).not.toMatch(/IS NULL/);
    expect(params).toEqual(['t1', 'tenantA']);
  });
  it('tier.getSubscribable includes the tenant\'s + platform-standard (NULL) tiers', async () => {
    const { provider, exec } = fakeReplica();
    await new MembershipTierRepository(provider).getSubscribable('tenantA', 't1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND \(tenant_id=\$2 OR tenant_id IS NULL\)/);
    expect(params).toEqual(['t1', 'tenantA']);
  });
  it('tier.insert guards uniqueness + binds tenant_id, no version', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const t = MembershipTier.create({ id: 't1', tenantId: 'tenantA', code: 'plus', defaultName: 'Plus', monthlyFeeMinor: 9900n, benefits: parseBenefits({}) });
    await new MembershipTierRepository(fakeReplica().provider).insert(tx as any, t);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO membership_tiers/); expect(sql).toMatch(/ON CONFLICT \(tenant_id, code\) DO NOTHING/);
    expect(sql).not.toMatch(/version/); expect(params).toContain('tenantA');
  });
  it('tier.listFor returns tenant + NULL tiers, keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new MembershipTierRepository(provider).listFor('tenantA', { limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/\(tenant_id=\$1 OR tenant_id IS NULL\)/); expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });

  it('membership.getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new UserMembershipRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'm1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/);
    expect(params).toEqual(['m1', 'tenantA']);
  });
  it('membership.findLiveForUser binds tenant_id + user + live statuses', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new UserMembershipRepository(fakeReplica().provider).findLiveForUser(tx as any, 'tenantA', 'u1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND user_id=\$2 AND status IN \('active','past_due'\)/);
    expect(params).toEqual(['tenantA', 'u1']);
  });
  it('membership.insert binds tenant_id, no version', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const m = UserMembership.subscribe({ id: 'm1', tenantId: 'tenantA', userId: 'u1', tierId: 't1', billingCycle: 'monthly' });
    await new UserMembershipRepository(fakeReplica().provider).insert(tx as any, m);
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO user_memberships/); expect(sql).not.toMatch(/version/); expect(params).toContain('tenantA');
  });
  it('membership.findDueToExpire is bounded + SKIP LOCKED over live statuses', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new UserMembershipRepository(fakeReplica().provider).findDueToExpire(tx as any, new Date(), 100);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/status IN \('active','past_due'\) AND current_period_end IS NOT NULL AND current_period_end < \$1::date/);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });
});
