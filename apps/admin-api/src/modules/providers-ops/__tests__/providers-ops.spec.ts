// apps/admin-api/src/modules/providers-ops/__tests__/providers-ops.spec.ts · unit tests (pure/mocked). Covers: the
// provider entity enable/disable (+ no-op 409); category validation; owner-RBAC for the providers roles +
// no-escalation/no-'*' (Law 11); DTO validation; and the services proving audit-in-tx on the toggle, 404s, the
// degraded-flag health logic, and — critically — that NO response shape ever carries a secret_ref (only counts).
import { IntegrationProvider } from '../domain/provider.entity';
import { assertCategory, FINANCIAL_CATEGORIES, PROVIDER_CATEGORIES } from '../domain/category';
import { ProviderNotFoundError, ProviderAlreadyInStateError, InvalidCategoryError } from '../domain/providers-ops.errors';
import { IntegrationProvidersAdminService } from '../services/integration-providers-admin.service';
import { ProviderSlaMonitorService } from '../services/provider-sla-monitor.service';
import { FinancialPartnersAdminService } from '../services/financial-partners-admin.service';
import { QueryProvidersSchema, ToggleProviderSchema } from '../dto/providers-ops.dto';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';

const actor = { userId: 'admin1', roles: ['platform_providers_ops'], ip: '10.0.0.1', requestId: 'req1' } as any;
const provider = (over: Partial<any> = {}) => IntegrationProvider.rehydrate({
  code: over.code ?? 'razorpay', defaultName: 'Razorpay', category: over.category ?? 'payment', isActive: over.isActive ?? true, createdAt: new Date('2026-05-01T00:00:00Z'),
});

describe('provider entity', () => {
  it('disable flips + reports change; enabling an active provider is a no-op 409', () => {
    const p = provider({ isActive: true });
    const c = p.disable();
    expect(c).toEqual({ action: 'disabled', oldValue: { isActive: true }, newValue: { isActive: false } });
    expect(p.isActive).toBe(false);
    expect(() => provider({ isActive: true }).enable()).toThrow(ProviderAlreadyInStateError);
    expect(() => provider({ isActive: false }).disable()).toThrow(ProviderAlreadyInStateError);
  });
  it('toJSON carries NO secret material', () => {
    const j: any = provider().toJSON();
    expect(j.secretRef).toBeUndefined();
    expect(Object.keys(j).sort()).toEqual(['category', 'code', 'createdAt', 'defaultName', 'isActive']);
  });
});

describe('category', () => {
  it('validates the known set; financial = payment+kyc', () => {
    expect(assertCategory('payment')).toBe('payment');
    expect(() => assertCategory('crypto')).toThrow(InvalidCategoryError);
    expect(FINANCIAL_CATEGORIES).toEqual(['payment', 'kyc']);
    expect(PROVIDER_CATEGORIES).toContain('government');
  });
});

describe('owner roles for providers', () => {
  it('providers_ops manage+read; viewer read-only; tenant roles NOTHING; no */money', () => {
    const ops = resolveOwnerPermissions(['platform_providers_ops']);
    expect(hasOwnerPermission(ops, OwnerPermissions.ProvidersManage)).toBe(true);
    expect(hasOwnerPermission(ops, OwnerPermissions.ProvidersRead)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_providers_viewer']), OwnerPermissions.ProvidersManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_providers_viewer']), OwnerPermissions.ProvidersRead)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['tenant_admin']), OwnerPermissions.ProvidersManage)).toBe(false);
    expect(ops.has('*')).toBe(false);
    expect(hasOwnerPermission(ops, OwnerPermissions.BillingManage)).toBe(false);
  });
});

describe('dto validation', () => {
  it('query enums + clamp; toggle enum + reason; reject unknown keys', () => {
    expect(QueryProvidersSchema.safeParse({ category: 'payment', isActive: 'true' }).success).toBe(true);
    expect(QueryProvidersSchema.safeParse({ category: 'crypto' }).success).toBe(false);
    expect(QueryProvidersSchema.safeParse({ limit: 999 }).success).toBe(false);
    expect(ToggleProviderSchema.safeParse({ action: 'disable', reason: 'razorpay outage — failover to sandbox' }).success).toBe(true);
    expect(ToggleProviderSchema.safeParse({ action: 'nuke', reason: 'x x' }).success).toBe(false);
    expect(ToggleProviderSchema.safeParse({ action: 'disable' }).success).toBe(false);   // reason required
    expect(ToggleProviderSchema.safeParse({ action: 'disable', reason: 'ok ok', evil: 1 }).success).toBe(false);
  });
});

function harness() {
  const client = { __c: true };
  const pool = { withTx: async (fn: any) => fn(client) } as any;
  const audit = { write: jest.fn(async () => undefined) } as any;
  return { client, pool, audit };
}

describe('IntegrationProvidersAdminService', () => {
  it('list merges credential-ref health (counts only, no secrets)', async () => {
    const repo = { listProviders: jest.fn(async () => [provider({ code: 'razorpay' })]), credentialHealthAll: jest.fn(async () => ({ razorpay: { configuredTenants: 5, activeTenants: 4 } })) } as any;
    const out: any = await new IntegrationProvidersAdminService({} as any, {} as any, repo).list({ limit: 50 } as any);
    expect(out.items[0].health).toEqual({ configuredTenants: 5, activeTenants: 4 });
    expect(out.items[0].secretRef).toBeUndefined();
  });
  it('get: 404 when missing', async () => {
    const repo = { getProvider: jest.fn(async () => null) } as any;
    await expect(new IntegrationProvidersAdminService({} as any, {} as any, repo).get('nope')).rejects.toBeInstanceOf(ProviderNotFoundError);
  });
  it('toggle disable: persists + change row + audit in-tx', async () => {
    const { pool, audit, client } = harness();
    const repo = { getProviderForUpdate: jest.fn(async () => provider({ isActive: true })), updateActive: jest.fn(), insertChange: jest.fn() } as any;
    const out: any = await new IntegrationProvidersAdminService(pool, audit, repo).toggle(actor, 'razorpay', { action: 'disable', reason: 'PSP outage' });
    expect(out.isActive).toBe(false);
    expect(repo.updateActive).toHaveBeenCalledWith(client, 'razorpay', false, 'admin1');
    expect(repo.insertChange).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'disabled' }));
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'providers.disabled' }));
  });
  it('toggle no-op (enable an active provider) throws + audits nothing', async () => {
    const { pool, audit } = harness();
    const repo = { getProviderForUpdate: jest.fn(async () => provider({ isActive: true })), updateActive: jest.fn(), insertChange: jest.fn() } as any;
    await expect(new IntegrationProvidersAdminService(pool, audit, repo).toggle(actor, 'razorpay', { action: 'enable', reason: 'already on' })).rejects.toBeInstanceOf(ProviderAlreadyInStateError);
    expect(repo.updateActive).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
  it('toggle 404 when provider missing', async () => {
    const { pool, audit } = harness();
    const repo = { getProviderForUpdate: jest.fn(async () => null) } as any;
    await expect(new IntegrationProvidersAdminService(pool, audit, repo).toggle(actor, 'nope', { action: 'disable', reason: 'x' })).rejects.toBeInstanceOf(ProviderNotFoundError);
  });
});

describe('ProviderSlaMonitorService', () => {
  it('flags degraded = disabled but still referenced by tenants; secret-free', async () => {
    const repo = {
      listAll: jest.fn(async () => [provider({ code: 'razorpay', isActive: false }), provider({ code: 'sandbox', isActive: true })]),
      credentialHealthAll: jest.fn(async () => ({ razorpay: { configuredTenants: 3, activeTenants: 3 }, sandbox: { configuredTenants: 0, activeTenants: 0 } })),
    } as any;
    const out: any = await new ProviderSlaMonitorService(repo).healthRollup();
    const rz = out.items.find((x: any) => x.code === 'razorpay');
    expect(rz.degraded).toBe(true);                 // disabled + 3 tenants still pointed at it
    expect(out.items[0].code).toBe('razorpay');     // degraded surfaced first
    expect(rz.secretRef).toBeUndefined();
  });
});

describe('FinancialPartnersAdminService', () => {
  it('lists financial-category providers with health', async () => {
    const repo = { listByCategories: jest.fn(async () => [provider({ code: 'razorpay', category: 'payment', isActive: true })]), credentialHealthAll: jest.fn(async () => ({ razorpay: { configuredTenants: 2, activeTenants: 2 } })) } as any;
    const out: any = await new FinancialPartnersAdminService(repo).list();
    expect(repo.listByCategories).toHaveBeenCalledWith(FINANCIAL_CATEGORIES);
    expect(out.items[0].health.configuredTenants).toBe(2);
    expect(out.items[0].degraded).toBe(false);
  });
});
