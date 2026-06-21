// apps/admin-api/src/modules/plans-ops/__tests__/plans-ops.spec.ts · unit tests (pure/mocked). Covers: the plan
// lifecycle state machine + entity (publish/archive/reactivate; prices bigint minor units; published-plan
// immutability — grandfathering); validation helpers (code/country/currency/price/limit); owner-RBAC for the
// plans roles + the NO-privilege-escalation property (Law 11); DTO validation (money strings, -1 limit, unknown
// keys); and the services proving every write audits IN-TX + writes a change row, the immutability/state-machine
// guards throw, composition edits are draft-only, an unknown feature is 404, and a missing plan is 404.
import { Plan } from '../domain/plan.entity';
import { canTransition, assertTransition, isActiveStatus, PLAN_STATUSES } from '../domain/plan.state';
import { assertPlanCode, assertCurrency, assertLimitValue, assertPrices } from '../domain/plan.entity';
import { InvalidPlanError, PlanImmutableError, IllegalPlanTransitionError, PlanNotFoundError, FeatureNotFoundError, PlanVersionExistsError } from '../domain/plans-ops.errors';
import { PlanCrudService } from '../services/plan-crud.service';
import { CustomPricingService } from '../services/custom-pricing.service';
import { PlanAssignmentService } from '../services/plan-assignment.service';
import { CreatePlanSchema, UpdatePlanLifecycleSchema, SetPricingSchema, SetLimitSchema, QueryPlansSchema } from '../dto/plans-ops.dto';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';

const actor = { userId: 'admin1', roles: ['platform_plans_ops'], ip: '10.0.0.1', requestId: 'req1' } as any;
const plan = (status: any = 'draft') => Plan.rehydrate({
  id: 'p1', code: 'growth', version: 1, defaultName: 'Growth', countryCode: 'IN', currencyCode: 'INR',
  monthlyPriceMinor: 499900n, annualPriceMinor: 4999900n, setupFeeMinor: 0n, isPublic: true, isActive: status === 'active', status, createdAt: new Date('2026-05-01T00:00:00Z'),
});

describe('plan lifecycle state machine', () => {
  it('draft→active→archived→active; draft→archived; bad transitions rejected', () => {
    expect(canTransition('draft', 'active')).toBe(true);
    expect(canTransition('active', 'archived')).toBe(true);
    expect(canTransition('archived', 'active')).toBe(true);
    expect(canTransition('active', 'draft')).toBe(false);
    expect(() => assertTransition('active', 'draft')).toThrow(IllegalPlanTransitionError);
    expect(isActiveStatus('active')).toBe(true); expect(isActiveStatus('draft')).toBe(false);
    expect(PLAN_STATUSES.length).toBe(3);
  });
});

describe('Plan entity', () => {
  it('publish flips status+is_active; archive/reactivate work; toJSON money as strings', () => {
    const p = plan('draft');
    expect(p.publish()).toEqual({ action: 'published', oldValue: { status: 'draft' }, newValue: { status: 'active' } });
    expect(p.toProps().isActive).toBe(true);
    expect(p.archive().newValue).toEqual({ status: 'archived' });
    expect(p.reactivate().action).toBe('reactivated');
    expect(p.toJSON().monthlyPriceMinor).toBe('499900');
    expect(typeof p.toJSON().monthlyPriceMinor).toBe('string');
  });
  it('prices are editable while DRAFT, immutable once published (grandfathering)', () => {
    const d = plan('draft');
    expect(d.setPrices(1000n, 10000n, 0n).action).toBe('price_changed');
    expect(() => plan('active').setPrices(1n, 1n, 0n)).toThrow(PlanImmutableError);
  });
  it('createDraft starts draft + not active + validates invariants', () => {
    const p = Plan.createDraft({ id: 'x', code: 'starter', defaultName: 'Starter', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: 0n, annualPriceMinor: 0n });
    expect(p.status).toBe('draft'); expect(p.toProps().isActive).toBe(false);
    expect(() => Plan.createDraft({ id: 'x', code: 'BAD CODE', defaultName: 'n', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: 0n, annualPriceMinor: 0n })).toThrow(InvalidPlanError);
    expect(() => Plan.createDraft({ id: 'x', code: 'ok', defaultName: 'n', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: -1n, annualPriceMinor: 0n })).toThrow(InvalidPlanError);
  });
});

describe('validation helpers', () => {
  it('code/currency/limit/price guards', () => {
    expect(assertPlanCode('growth_2')).toBe('growth_2');
    expect(() => assertPlanCode('Growth')).toThrow(InvalidPlanError);
    expect(() => assertCurrency('inr')).toThrow(InvalidPlanError);
    expect(assertLimitValue(-1n)).toBe(-1n);             // -1 = unlimited
    expect(() => assertLimitValue(-2n)).toThrow(InvalidPlanError);
    expect(() => assertPrices(1n, -1n, 0n)).toThrow(InvalidPlanError);
  });
});

describe('owner roles for plans', () => {
  it('platform_plans_ops manage+read; viewer read-only; tenant roles NOTHING; no cross-perm', () => {
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_plans_ops']), OwnerPermissions.PlansManage)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_plans_viewer']), OwnerPermissions.PlansManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_plans_viewer']), OwnerPermissions.PlansRead)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['tenant_admin']), OwnerPermissions.PlansManage)).toBe(false);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_plans_ops']), OwnerPermissions.BillingManage)).toBe(false);
  });
});

describe('dto validation', () => {
  it('create: money as digit-strings + valid code; rejects float/unknown keys', () => {
    const ok = { code: 'growth', defaultName: 'Growth', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '499900', annualPriceMinor: '4999900', reason: 'new plan' };
    expect(CreatePlanSchema.safeParse(ok).success).toBe(true);
    expect(CreatePlanSchema.safeParse({ ...ok, monthlyPriceMinor: '49.99' }).success).toBe(false);
    expect(CreatePlanSchema.safeParse({ ...ok, evil: 1 }).success).toBe(false);
  });
  it('lifecycle enum; pricing money strings; limit accepts -1; query clamps', () => {
    expect(UpdatePlanLifecycleSchema.safeParse({ action: 'publish', reason: 'go live' }).success).toBe(true);
    expect(UpdatePlanLifecycleSchema.safeParse({ action: 'delete', reason: 'x x' }).success).toBe(false);
    expect(SetPricingSchema.safeParse({ monthlyPriceMinor: '100', annualPriceMinor: '1000', reason: 'reprice' }).success).toBe(true);
    expect(SetLimitSchema.safeParse({ limitValue: '-1', reason: 'unlimited farmers' }).success).toBe(true);
    expect(SetLimitSchema.safeParse({ limitValue: '-5', reason: 'x x' }).success).toBe(false);
    expect(QueryPlansSchema.safeParse({ limit: 999 }).success).toBe(false);
  });
});

function harness() {
  const client = { __c: true };
  const pool = { withTx: async (fn: any) => fn(client) } as any;
  const audit = { write: jest.fn(async () => undefined) } as any;
  return { client, pool, audit };
}

describe('PlanCrudService', () => {
  it('create: next version + draft + change row + audit in-tx', async () => {
    const { pool, audit, client } = harness();
    const repo = { maxVersion: jest.fn(async () => 0), insertPlan: jest.fn(async () => plan('draft')), insertChange: jest.fn() } as any;
    const out: any = await new PlanCrudService(pool, audit, repo).create(actor, { code: 'growth', defaultName: 'Growth', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '499900', annualPriceMinor: '4999900', setupFeeMinor: '0', isPublic: true, reason: 'new plan' });
    expect(out.status).toBe('draft');
    expect(repo.insertChange).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'created' }));
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'plans.created' }));
  });
  it('create: version conflict surfaces as 409', async () => {
    const { pool, audit } = harness();
    const repo = { maxVersion: jest.fn(async () => 1), insertPlan: jest.fn(async () => { throw new PlanVersionExistsError('growth', 2, 'IN'); }), insertChange: jest.fn() } as any;
    await expect(new PlanCrudService(pool, audit, repo).create(actor, { code: 'growth', defaultName: 'G', countryCode: 'IN', currencyCode: 'INR', monthlyPriceMinor: '1', annualPriceMinor: '1', setupFeeMinor: '0', isPublic: true, reason: 'dup' })).rejects.toBeInstanceOf(PlanVersionExistsError);
  });
  it('lifecycle publish: audits old→new in-tx', async () => {
    const { pool, audit, client } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('draft')), updateLifecycle: jest.fn(), insertChange: jest.fn() } as any;
    await new PlanCrudService(pool, audit, repo).updateLifecycle(actor, 'p1', { action: 'publish', reason: 'go live' });
    expect(repo.updateLifecycle).toHaveBeenCalledWith(client, 'p1', 'active', true, 'admin1');
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'plans.published', oldValue: { status: 'draft' } }));
  });
  it('lifecycle: illegal transition throws + audits nothing', async () => {
    const { pool, audit } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('active')), updateLifecycle: jest.fn(), insertChange: jest.fn() } as any;
    await expect(new PlanCrudService(pool, audit, repo).updateLifecycle(actor, 'p1', { action: 'publish', reason: 'x x' })).rejects.toBeInstanceOf(IllegalPlanTransitionError);
    expect(audit.write).not.toHaveBeenCalled();
  });
  it('get: 404 when missing', async () => {
    const { pool, audit } = harness();
    const repo = { getPlan: jest.fn(async () => null) } as any;
    await expect(new PlanCrudService(pool, audit, repo).get('nope')).rejects.toBeInstanceOf(PlanNotFoundError);
  });
});

describe('CustomPricingService', () => {
  it('setPrices on a published plan throws PlanImmutableError + audits nothing', async () => {
    const { pool, audit } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('active')), updatePricing: jest.fn(), insertChange: jest.fn() } as any;
    await expect(new CustomPricingService(pool, audit, repo).setPrices(actor, 'p1', { monthlyPriceMinor: '1', annualPriceMinor: '1', setupFeeMinor: '0', reason: 'reprice' })).rejects.toBeInstanceOf(PlanImmutableError);
    expect(repo.updatePricing).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
  it('version: clones source into a new draft version + composition + audit (grandfathering)', async () => {
    const { pool, audit, client } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('active')), maxVersion: jest.fn(async () => 1), insertPlan: jest.fn(async () => plan('draft')), cloneComposition: jest.fn(), insertChange: jest.fn() } as any;
    await new CustomPricingService(pool, audit, repo).version(actor, 'p1', { monthlyPriceMinor: '599900', annualPriceMinor: '5999900', setupFeeMinor: '0', reason: 'price increase v2' });
    expect(repo.cloneComposition).toHaveBeenCalledWith(client, 'p1', expect.any(String));
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'plans.versioned' }));
  });
});

describe('PlanAssignmentService', () => {
  it('setLimit on a DRAFT plan upserts + change row + audit in-tx', async () => {
    const { pool, audit, client } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('draft')), upsertLimit: jest.fn(), insertChange: jest.fn() } as any;
    await new PlanAssignmentService(pool, audit, repo).setLimit(actor, 'p1', 'max_farmers', { limitValue: '-1', reason: 'unlimited' });
    expect(repo.upsertLimit).toHaveBeenCalledWith(client, 'p1', 'max_farmers', -1n);
    expect(audit.write).toHaveBeenCalledWith(client, expect.objectContaining({ action: 'plans.limit_set' }));
  });
  it('setFeature: unknown feature → 404 (FK-safe)', async () => {
    const { pool, audit } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('draft')), featureExists: jest.fn(async () => false), upsertFeature: jest.fn() } as any;
    await expect(new PlanAssignmentService(pool, audit, repo).setFeature(actor, 'p1', 'bidding', { isIncluded: true, reason: 'enable bidding' })).rejects.toBeInstanceOf(FeatureNotFoundError);
    expect(repo.upsertFeature).not.toHaveBeenCalled();
  });
  it('composition edit on a PUBLISHED plan throws PlanImmutableError (grandfathering)', async () => {
    const { pool, audit } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => plan('active')), upsertLimit: jest.fn() } as any;
    await expect(new PlanAssignmentService(pool, audit, repo).setLimit(actor, 'p1', 'max_farmers', { limitValue: '100', reason: 'x x' })).rejects.toBeInstanceOf(PlanImmutableError);
    expect(repo.upsertLimit).not.toHaveBeenCalled();
  });
  it('setLimit: 404 when plan missing', async () => {
    const { pool, audit } = harness();
    const repo = { getPlanForUpdate: jest.fn(async () => null) } as any;
    await expect(new PlanAssignmentService(pool, audit, repo).setLimit(actor, 'nope', 'max_farmers', { limitValue: '1', reason: 'x x' })).rejects.toBeInstanceOf(PlanNotFoundError);
  });
});
