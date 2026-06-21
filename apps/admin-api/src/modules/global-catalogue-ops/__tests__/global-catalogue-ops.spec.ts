// apps/admin-api/src/modules/global-catalogue-ops/__tests__/global-catalogue-ops.spec.ts · UNIT suite (pure /
// mocked). Proves the master-taxonomy invariants: code/slug/name/meta validation + plain-text (no-HTML) guard,
// the category-tree maths (depth ≤ 5, cycle prevention, bounded moves, leaf derivation), entity mutation/no-op
// guards, owner-RBAC least-privilege (no escalation, no '*'), zod .strict DTOs, and the services' audit-in-tx +
// duplicate / 404 / fail-closed behaviour (pool/repo/audit mocked).
import { assertPlainText } from '../domain/text';
import {
  assertTypeCode, assertValueCode, assertTypeName, assertValueName, assertMeta, assertSortOrder,
} from '../domain/lookup-vocab';
import {
  assertSlug, deriveCode, deriveDepth, leafSlug, isSelfOrDescendant, assertNoCycle, assertMovedDepthWithinLimit,
  assertCommerceKind, assertMinAge, MAX_DEPTH,
} from '../domain/category-tree';
import { LookupValue } from '../domain/lookup.entity';
import { Category } from '../domain/category.entity';
import {
  InvalidCatalogueInputError, CategoryDepthExceededError, CategoryCycleError, CatalogueAlreadyInStateError,
  DuplicateCatalogueCodeError, LookupTypeNotFoundError, LookupValueNotFoundError, CategoryNotFoundError,
  CategoryHasActiveChildrenError, ParentInactiveError, SubtreeTooLargeError,
} from '../domain/catalogue.errors';
import { resolveOwnerPermissions, hasOwnerPermission, OwnerPermissions } from '../../../core/rbac/owner-roles';
import {
  CreateCategorySchema, CreateLookupValueSchema, UpdateLookupValueSchema, MoveCategorySchema, CreateLookupTypeSchema,
} from '../dto/catalogue.dto';
import { LookupVocabAdminService } from '../services/lookup-vocab-admin.service';
import { CategoriesAdminService } from '../services/categories-admin.service';

const lvProps = (over: Partial<any> = {}) => ({ id: 'v1', typeCode: 'cert_type', code: 'npop', defaultName: 'NPOP', meta: {}, sortOrder: 100, isActive: true, ...over });
const catProps = (over: Partial<any> = {}) => ({ id: 'c1', parentId: null, code: 'crops', defaultName: 'Crops', path: 'crops', depth: 1, commerceKind: 'goods', requiresLicense: false, requiresCertificate: false, minAge: null, isActive: true, sortOrder: 100, iconMediaId: null, ...over });

describe('text — plain-text guard (stored-XSS closed by construction)', () => {
  it('rejects HTML angle brackets', () => { expect(() => assertPlainText('<b>x</b>', 'name', 50)).toThrow(InvalidCatalogueInputError); });
  it('rejects control chars', () => { expect(() => assertPlainText('ab', 'name', 50)).toThrow(InvalidCatalogueInputError); });
  it('rejects empty / over-length', () => { expect(() => assertPlainText('  ', 'name', 50)).toThrow(); expect(() => assertPlainText('x'.repeat(51), 'name', 50)).toThrow(); });
  it('accepts + trims clean text', () => { expect(assertPlainText('  Wheat  ', 'name', 50)).toBe('Wheat'); });
});

describe('lookup-vocab — code / name / meta / sort guards', () => {
  it('type code must be lowercase identifier', () => {
    expect(assertTypeCode('cancel_reason')).toBe('cancel_reason');
    expect(() => assertTypeCode('Cancel-Reason')).toThrow(InvalidCatalogueInputError);
    expect(() => assertTypeCode('1bad')).toThrow();
  });
  it('value code allows dotted/hyphen lowercase', () => {
    expect(assertValueCode('pgs_india')).toBe('pgs_india');
    expect(assertValueCode('usda-organic')).toBe('usda-organic');
    expect(() => assertValueCode('Has Space')).toThrow();
  });
  it('names are plain-text + bounded', () => { expect(assertTypeName('Doc Type')).toBe('Doc Type'); expect(() => assertValueName('<x>')).toThrow(); });
  it('sort order is a smallint range', () => { expect(assertSortOrder(100)).toBe(100); expect(() => assertSortOrder(-1)).toThrow(); expect(() => assertSortOrder(40000)).toThrow(); });
  it('meta rejects nesting / too many keys / oversize, accepts primitives + arrays', () => {
    expect(assertMeta({ a: 1, b: 'x', c: true, d: null, e: [1, 2] })).toBeTruthy();
    expect(() => assertMeta({ nested: { a: 1 } } as any)).toThrow(InvalidCatalogueInputError);
    const many: Record<string, number> = {}; for (let i = 0; i < 51; i++) many[`k${i}`] = i;
    expect(() => assertMeta(many)).toThrow();
    expect(() => assertMeta({ big: 'x'.repeat(4100) })).toThrow();
  });
});

describe('category-tree — derivation + invariants', () => {
  it('slug is ltree-safe lowercase', () => { expect(assertSlug('cereals')).toBe('cereals'); expect(() => assertSlug('Cereals')).toThrow(); expect(() => assertSlug('a.b')).toThrow(); });
  it('derives dotted code + depth, enforcing the 5-level limit', () => {
    expect(deriveCode(null, 'crops')).toBe('crops');
    expect(deriveCode('crops.cereals', 'wheat')).toBe('crops.cereals.wheat');
    expect(deriveDepth(null)).toBe(1);
    expect(deriveDepth(4)).toBe(5);
    expect(() => deriveDepth(5)).toThrow(CategoryDepthExceededError);
  });
  it('leafSlug returns the last label', () => { expect(leafSlug('crops.cereals.wheat')).toBe('wheat'); expect(leafSlug('crops')).toBe('crops'); });
  it('cycle detection: a node cannot move under itself or a descendant', () => {
    expect(isSelfOrDescendant('crops.cereals', 'crops')).toBe(true);
    expect(isSelfOrDescendant('crops', 'crops')).toBe(true);
    expect(isSelfOrDescendant('dairy', 'crops')).toBe(false);
    expect(() => assertNoCycle('crops.cereals', 'crops')).toThrow(CategoryCycleError);
    expect(() => assertNoCycle('dairy', 'crops')).not.toThrow();
    expect(() => assertNoCycle(null, 'crops')).not.toThrow();   // move to root is fine
  });
  it('moved subtree must still fit within max depth', () => {
    expect(() => assertMovedDepthWithinLimit(MAX_DEPTH, +1)).toThrow(CategoryDepthExceededError);
    expect(() => assertMovedDepthWithinLimit(3, +1)).not.toThrow();
  });
  it('commerce kind + min age guards', () => {
    expect(assertCommerceKind('input_regulated')).toBe('input_regulated');
    expect(() => assertCommerceKind('weapons')).toThrow();
    expect(assertMinAge(18)).toBe(18); expect(assertMinAge(null)).toBeNull(); expect(() => assertMinAge(200)).toThrow();
  });
});

describe('entities — mutation + no-op guards', () => {
  it('LookupValue.update: no-op throws; rename vs updated classified; code immutable', () => {
    const v = LookupValue.rehydrate(lvProps());
    expect(() => v.update({ defaultName: 'NPOP' })).toThrow(CatalogueAlreadyInStateError);   // unchanged
    expect(v.update({ defaultName: 'NPOP Organic' }).action).toBe('renamed');
    expect(v.update({ sortOrder: 5 }).action).toBe('updated');
    expect((v.toJSON() as any).code).toBe('npop');
  });
  it('LookupValue.setActive: no-op throws, toggles otherwise', () => {
    const v = LookupValue.rehydrate(lvProps());
    expect(() => v.setActive(true)).toThrow(CatalogueAlreadyInStateError);
    expect(v.setActive(false).action).toBe('deactivated');
  });
  it('Category.update + setActive guards', () => {
    const c = Category.rehydrate(catProps());
    expect(c.update({ requiresLicense: true }).action).toBe('updated');
    expect(() => c.update({ requiresLicense: true }).action).toThrow(CatalogueAlreadyInStateError);  // already true
    expect(c.setActive(false).action).toBe('deactivated');
    expect(() => c.setActive(false)).toThrow(CatalogueAlreadyInStateError);
  });
});

describe('owner RBAC — least privilege (Law 11, no escalation)', () => {
  it('catalogue roles grant exactly catalogue perms, never *', () => {
    const ops = resolveOwnerPermissions(['platform_catalogue_ops']);
    expect(ops.has(OwnerPermissions.CatalogueManage)).toBe(true);
    expect(ops.has(OwnerPermissions.CatalogueRead)).toBe(true);
    expect(ops.has('*')).toBe(false);
    const viewer = resolveOwnerPermissions(['platform_catalogue_viewer']);
    expect(viewer.has(OwnerPermissions.CatalogueRead)).toBe(true);
    expect(viewer.has(OwnerPermissions.CatalogueManage)).toBe(false);
  });
  it('unknown / tenant roles grant nothing here', () => {
    expect(resolveOwnerPermissions(['tenant_admin', 'owner']).size).toBe(0);
  });
  it('hasOwnerPermission honours super_admin * but plain perms are scoped', () => {
    expect(hasOwnerPermission(resolveOwnerPermissions(['super_admin']), OwnerPermissions.CatalogueManage)).toBe(true);
    expect(hasOwnerPermission(resolveOwnerPermissions(['platform_catalogue_viewer']), OwnerPermissions.CatalogueManage)).toBe(false);
  });
});

describe('DTO — zod .strict() validation', () => {
  it('rejects unknown keys (mass-assignment)', () => {
    expect(CreateLookupTypeSchema.safeParse({ code: 'doc_type', defaultName: 'Doc', reason: 'init', evil: 1 }).success).toBe(false);
  });
  it('create category enforces slug regex + reason', () => {
    expect(CreateCategorySchema.safeParse({ slug: 'wheat', defaultName: 'Wheat', reason: 'add leaf' }).success).toBe(true);
    expect(CreateCategorySchema.safeParse({ slug: 'WHEAT', defaultName: 'Wheat', reason: 'x' }).success).toBe(false);
    expect(CreateCategorySchema.safeParse({ slug: 'wheat', defaultName: 'Wheat' }).success).toBe(false);   // no reason
  });
  it('create lookup value validates codes; update requires at least one field', () => {
    expect(CreateLookupValueSchema.safeParse({ typeCode: 'cert_type', code: 'npop', defaultName: 'NPOP', reason: 'add' }).success).toBe(true);
    expect(UpdateLookupValueSchema.safeParse({ reason: 'noop' }).success).toBe(false);
    expect(UpdateLookupValueSchema.safeParse({ sortOrder: 5, reason: 'reorder' }).success).toBe(true);
  });
  it('move category accepts null (to-root) parent', () => {
    expect(MoveCategorySchema.safeParse({ newParentId: null, reason: 'promote to root' }).success).toBe(true);
    expect(MoveCategorySchema.safeParse({ newParentId: 'not-a-uuid', reason: 'x' }).success).toBe(false);
  });
});

/* ---------------- services (pool/repo/audit mocked) ---------------- */
const actor = { userId: 'u1', roles: ['platform_catalogue_ops'], ip: '10.0.0.1', requestId: 'rq1' } as any;
function fakeTxPool() {
  const client = {};
  return { withTx: jest.fn(async (fn: any) => fn(client)), query: jest.fn() } as any;
}

describe('LookupVocabAdminService — audit-in-tx + duplicate + 404', () => {
  it('createValue writes change + audit in the SAME tx and rejects duplicates', async () => {
    const pool = fakeTxPool();
    const audit = { write: jest.fn(), log: jest.fn() } as any;
    const repo = {
      getLookupType: jest.fn().mockResolvedValue({ code: 'cert_type' }),
      platformValueCodeExists: jest.fn().mockResolvedValue(false),
      insertLookupValue: jest.fn().mockResolvedValue({ id: 'v9', createdAt: new Date() }),
      insertChange: jest.fn(),
    } as any;
    const svc = new LookupVocabAdminService(pool, audit, repo);
    const res: any = await svc.createValue(actor, { typeCode: 'cert_type', code: 'npop', defaultName: 'NPOP', meta: {}, sortOrder: 100, reason: 'add' });
    expect(res.id).toBe('v9');
    expect(pool.withTx).toHaveBeenCalledTimes(1);
    expect(repo.insertChange).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledTimes(1);

    repo.platformValueCodeExists.mockResolvedValue(true);
    await expect(svc.createValue(actor, { typeCode: 'cert_type', code: 'npop', defaultName: 'NPOP', meta: {}, sortOrder: 100, reason: 'dup' })).rejects.toBeInstanceOf(DuplicateCatalogueCodeError);
  });
  it('createValue 404s on unknown type; setValueActive 404s on unknown value', async () => {
    const pool = fakeTxPool();
    const repo = { getLookupType: jest.fn().mockResolvedValue(null), getLookupValueForUpdate: jest.fn().mockResolvedValue(null) } as any;
    const svc = new LookupVocabAdminService(pool, { write: jest.fn() } as any, repo);
    await expect(svc.createValue(actor, { typeCode: 'nope', code: 'x', defaultName: 'X', meta: {}, sortOrder: 1, reason: 'r' })).rejects.toBeInstanceOf(LookupTypeNotFoundError);
    await expect(svc.setValueActive(actor, 'missing', { isActive: false, reason: 'r' })).rejects.toBeInstanceOf(LookupValueNotFoundError);
  });
});

describe('CategoriesAdminService — tree write rules', () => {
  it('create under a parent derives code/depth, audits in-tx', async () => {
    const pool = fakeTxPool();
    const audit = { write: jest.fn() } as any;
    const repo = {
      getCategoryForUpdate: jest.fn().mockResolvedValue(Category.rehydrate(catProps({ id: 'p', code: 'crops', depth: 1, isActive: true }))),
      categoryCodeExists: jest.fn().mockResolvedValue(false),
      insertCategory: jest.fn().mockResolvedValue({ id: 'c2', createdAt: new Date(), path: 'crops.cereals' }),
      insertChange: jest.fn(),
    } as any;
    const svc = new CategoriesAdminService(pool, audit, repo);
    const res: any = await svc.create(actor, { parentId: 'p', slug: 'cereals', defaultName: 'Cereals', commerceKind: 'goods', requiresLicense: false, requiresCertificate: false, sortOrder: 100, reason: 'add' });
    expect(res.code).toBe('crops.cereals');
    expect(res.depth).toBe(2);
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(repo.insertChange).toHaveBeenCalledTimes(1);
  });
  it('create under an inactive parent fails closed', async () => {
    const pool = fakeTxPool();
    const repo = { getCategoryForUpdate: jest.fn().mockResolvedValue(Category.rehydrate(catProps({ id: 'p', isActive: false }))) } as any;
    const svc = new CategoriesAdminService(pool, { write: jest.fn() } as any, repo);
    await expect(svc.create(actor, { parentId: 'p', slug: 'x', defaultName: 'X', commerceKind: 'goods', requiresLicense: false, requiresCertificate: false, sortOrder: 100, reason: 'r' })).rejects.toBeInstanceOf(ParentInactiveError);
  });
  it('move rejects a cyclic reparent (under a descendant)', async () => {
    const pool = fakeTxPool();
    const node = Category.rehydrate(catProps({ id: 'n', parentId: null, code: 'crops', path: 'crops', depth: 1 }));
    const newParent = Category.rehydrate(catProps({ id: 'd', parentId: 'n', code: 'crops.cereals', path: 'crops.cereals', depth: 2, isActive: true }));
    const repo = { getCategoryForUpdate: jest.fn().mockImplementation((_c: any, id: string) => Promise.resolve(id === 'n' ? node : newParent)) } as any;
    const svc = new CategoriesAdminService(pool, { write: jest.fn() } as any, repo);
    await expect(svc.move(actor, 'n', { newParentId: 'd', reason: 'r' })).rejects.toBeInstanceOf(CategoryCycleError);
  });
  it('move rejects an oversized subtree', async () => {
    const pool = fakeTxPool();
    const node = Category.rehydrate(catProps({ id: 'n', parentId: null, code: 'crops', path: 'crops', depth: 1 }));
    const target = Category.rehydrate(catProps({ id: 't', parentId: null, code: 'dairy', path: 'dairy', depth: 1, isActive: true }));
    const repo = {
      getCategoryForUpdate: jest.fn().mockImplementation((_c: any, id: string) => Promise.resolve(id === 'n' ? node : target)),
      categoryCodeExists: jest.fn().mockResolvedValue(false),
      subtreeStats: jest.fn().mockResolvedValue({ count: 5000, maxDepth: 2 }),
    } as any;
    const svc = new CategoriesAdminService(pool, { write: jest.fn() } as any, repo);
    await expect(svc.move(actor, 'n', { newParentId: 't', reason: 'r' })).rejects.toBeInstanceOf(SubtreeTooLargeError);
  });
  it('deactivate is blocked when active children exist; 404 on unknown', async () => {
    const pool = fakeTxPool();
    const repo = {
      getCategoryForUpdate: jest.fn().mockResolvedValue(Category.rehydrate(catProps({ id: 'c', isActive: true }))),
      countActiveChildren: jest.fn().mockResolvedValue(3),
    } as any;
    const svc = new CategoriesAdminService(pool, { write: jest.fn() } as any, repo);
    await expect(svc.setActive(actor, 'c', { isActive: false, reason: 'r' })).rejects.toBeInstanceOf(CategoryHasActiveChildrenError);

    repo.getCategoryForUpdate.mockResolvedValue(null);
    await expect(svc.setActive(actor, 'missing', { isActive: false, reason: 'r' })).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
