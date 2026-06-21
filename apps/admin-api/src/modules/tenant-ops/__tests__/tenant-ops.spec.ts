// apps/admin-api/src/modules/tenant-ops/__tests__/tenant-ops.spec.ts · unit tests (pure/mocked).
// Covers: the tenant lifecycle state machine; the entity's approve/suspend/archive guards; owner-RBAC resolution
// for the tenant_ops roles + the NO-privilege-escalation property (Law 11); and the services proving every
// write audits IN-TX, the state machine is enforced, and a missing tenant is a typed 404.
import { Tenant } from '../domain/tenant.entity';
import { canTransition, assertTransition, IllegalTenantTransitionError, TENANT_STATUSES } from '../domain/tenant.state';
import { TenantNotFoundError, InvalidTenantOpError } from '../domain/tenant-ops.errors';
import { ApproveTenantService } from '../services/approve-tenant.service';
import { SuspendTenantService } from '../services/suspend-tenant.service';
import { ArchiveTenantService } from '../services/archive-tenant.service';
import { OverrideLimitsService } from '../services/override-limits.service';
import { OverrideLimitSchema, QueryTenantsSchema } from '../dto/tenant-ops.dto';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';

const tenant = (status: any) => Tenant.rehydrate({ id: 't1', slug: 'acme', status, riskScore: 10, approvedAt: null });
const actor = { userId: 'admin1', roles: ['platform_tenant_ops'], ip: '10.0.0.1', requestId: 'req1' } as any;

// ---------- state machine ----------
describe('tenant state machine', () => {
  it('allows the documented lifecycle moves', () => {
    expect(canTransition('pending', 'active')).toBe(true);
    expect(canTransition('active', 'suspended')).toBe(true);
    expect(canTransition('suspended', 'active')).toBe(true);
    expect(canTransition('active', 'archived')).toBe(true);
    expect(canTransition('archived', 'terminated')).toBe(true);
  });
  it('rejects illegal moves; terminated + archived are near/terminal', () => {
    expect(canTransition('terminated', 'active')).toBe(false);
    expect(canTransition('archived', 'active')).toBe(false);
    expect(() => assertTransition('terminated', 'active')).toThrow(IllegalTenantTransitionError);
  });
  it('every status is covered', () => { expect(TENANT_STATUSES.length).toBe(7); });
});

// ---------- entity guards ----------
describe('Tenant entity', () => {
  it('approve only from pending/trial → active + stamps approvedAt', () => {
    const t = tenant('pending');
    const c = t.approve();
    expect(c).toMatchObject({ from: 'pending', to: 'active' });
    expect(c.approvedAt).toBeInstanceOf(Date);
    expect(t.status).toBe('active');
  });
  it('approve from a non-pending/trial state throws InvalidTenantOpError', () => {
    expect(() => tenant('suspended').approve()).toThrow(InvalidTenantOpError);
  });
  it('suspend requires a live state; archive from suspended ok', () => {
    expect(tenant('active').suspend()).toEqual({ from: 'active', to: 'suspended' });
    expect(() => tenant('archived').suspend()).toThrow(IllegalTenantTransitionError);
    expect(tenant('suspended').archive()).toEqual({ from: 'suspended', to: 'archived' });
  });
});

// ---------- owner RBAC (Law 11: no privilege escalation) ----------
describe('owner roles for tenant ops', () => {
  it('platform_tenant_ops gets manage+read; viewer read-only; tenant roles get NOTHING', () => {
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_tenant_ops']), OwnerPermissions.TenantManage)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_tenant_viewer']), OwnerPermissions.TenantManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_tenant_viewer']), OwnerPermissions.TenantRead)).toBe(true);
    // a TENANT role (e.g. tenant_admin) can never resolve a platform permission
    expect(hasOwnerPermission(resolveOwnerPermissions(['tenant_admin']), OwnerPermissions.TenantManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['super_admin']), OwnerPermissions.TenantManage)).toBe(true);
  });
});

// ---------- DTO validation ----------
describe('dto validation', () => {
  it('override-limit accepts int/-1 string, rejects floats + unknown keys', () => {
    expect(OverrideLimitSchema.safeParse({ limitCode: 'max_farmers', limitValue: 5000, reason: 'pilot deal' }).success).toBe(true);
    expect(OverrideLimitSchema.safeParse({ limitCode: 'max_farmers', limitValue: '-1', reason: 'unlimited pilot' }).success).toBe(true);
    expect(OverrideLimitSchema.safeParse({ limitCode: 'max_farmers', limitValue: 1.5, reason: 'abc' }).success).toBe(false);
    expect(OverrideLimitSchema.safeParse({ limitCode: 'BAD CODE', limitValue: 1, reason: 'abc' }).success).toBe(false);
    expect(OverrideLimitSchema.safeParse({ limitCode: 'ok', limitValue: 1, reason: 'abc', evil: 1 }).success).toBe(false); // strict
  });
  it('query clamps limit + coerces', () => {
    expect(QueryTenantsSchema.parse({}).limit).toBe(50);
    expect(QueryTenantsSchema.safeParse({ limit: 999 }).success).toBe(false);
  });
});

// ---------- services: audit-in-tx + state machine enforced ----------
function harness() {
  const client = { __c: true };
  const pool = { withTx: async (fn: any) => fn(client) } as any;
  const audit = { write: jest.fn(async () => undefined) } as any;
  return { client, pool, audit };
}

describe('ApproveTenantService', () => {
  it('locks, transitions, writes status-event + audit IN THE SAME tx', async () => {
    const { pool, audit, client } = harness();
    const repo = {
      getForUpdate: jest.fn(async () => tenant('pending')),
      updateStatus: jest.fn(async () => undefined),
      insertStatusEvent: jest.fn(async () => undefined),
    } as any;
    const svc = new ApproveTenantService(pool, audit, repo);
    const out = await svc.approve(actor, 't1', { reason: 'kyc verified' });
    expect(out.status).toBe('active');
    expect(repo.getForUpdate).toHaveBeenCalledWith(client, 't1');
    expect(repo.updateStatus).toHaveBeenCalled();
    expect(repo.insertStatusEvent).toHaveBeenCalledWith(client, 't1', 'pending', 'active', 'kyc verified', 'admin1');
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'tenant.approved', entityId: 't1' }));
  });
  it('404 when the tenant does not exist', async () => {
    const { pool, audit } = harness();
    const repo = { getForUpdate: jest.fn(async () => null) } as any;
    await expect(new ApproveTenantService(pool, audit, repo).approve(actor, 'nope', { reason: 'abc' })).rejects.toBeInstanceOf(TenantNotFoundError);
  });
});

describe('Suspend/Archive services enforce the state machine', () => {
  it('suspend of an archived tenant throws (illegal) + audits nothing', async () => {
    const { pool, audit } = harness();
    const repo = { getForUpdate: jest.fn(async () => tenant('archived')), updateStatus: jest.fn(), insertStatusEvent: jest.fn() } as any;
    await expect(new SuspendTenantService(pool, audit, repo).suspend(actor, 't1', { reason: 'abuse hold' })).rejects.toBeInstanceOf(IllegalTenantTransitionError);
    expect(audit.write).not.toHaveBeenCalled();
  });
  it('archive writes audit + status event', async () => {
    const { pool, audit, client } = harness();
    const repo = { getForUpdate: jest.fn(async () => tenant('active')), updateStatus: jest.fn(), insertStatusEvent: jest.fn() } as any;
    await new ArchiveTenantService(pool, audit, repo).archive(actor, 't1', { reason: 'offboard' });
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'tenant.archived' }));
  });
});

describe('OverrideLimitsService', () => {
  it('404 if tenant missing; else upserts override + audits old→new', async () => {
    const { pool, audit, client } = harness();
    const repoMissing = { exists: jest.fn(async () => false) } as any;
    await expect(new OverrideLimitsService(pool, audit, repoMissing).override(actor, 't1', { limitCode: 'max_farmers', limitValue: '5000', reason: 'pilot' })).rejects.toBeInstanceOf(TenantNotFoundError);

    const repo = { exists: jest.fn(async () => true), upsertLimitOverride: jest.fn(async () => ({ previous: '1000' })) } as any;
    const out = await new OverrideLimitsService(pool, audit, repo).override(actor, 't1', { limitCode: 'max_farmers', limitValue: '5000', reason: 'pilot' });
    expect(out).toMatchObject({ tenantId: 't1', limitCode: 'max_farmers', limitValue: '5000', previous: '1000' });
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'tenant.limit_override_set', oldValue: { limitCode: 'max_farmers', limitValue: '1000' } }));
  });
});
