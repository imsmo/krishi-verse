// apps/admin-api/src/modules/global-catalogue-ops/services/categories-admin.service.ts · the category-tree
// registry: list/get/children + create / update (rename + flags) / MOVE (reparent a subtree) / (de)activate, and
// change history. One ACID tx per write; every write commits a catalogue_changes row + an append-only audit_log
// row IN THE SAME TX (§4). The hard invariants are enforced fail-closed: depth ≤ 5, no cycles, bounded subtree
// moves, no orphaning (can't deactivate a node with active children, can't activate under an inactive parent).
// Categories are never hard-deleted — deactivate retires a branch while keeping product FK references valid.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { CatalogueRepository, CategoryListQuery, ChangeListQuery } from '../repositories/catalogue.repository';
import { CategoryNotFoundError, DuplicateCatalogueCodeError, ParentInactiveError, CategoryHasActiveChildrenError, InvalidCatalogueInputError, SubtreeTooLargeError } from '../domain/catalogue.errors';
import { assertSlug, assertCategoryName, assertCommerceKind, assertMinAge, deriveCode, deriveDepth, leafSlug, assertNoCycle, assertMovedDepthWithinLimit, MAX_SUBTREE_MOVE } from '../domain/category-tree';
import { CreateCategoryDto, UpdateCategoryDto, MoveCategoryDto, SetActiveDto } from '../dto/catalogue.dto';

const tsCursor = (createdAt: any, id: string) => Buffer.from(`${createdAt?.toISOString?.() ?? createdAt}|${id}`).toString('base64');

@Injectable()
export class CategoriesAdminService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: CatalogueRepository) {}

  /* ---------------- reads ---------------- */
  async list(q: CategoryListQuery) {
    const items = (await this.repo.listCategories(q)).map((c) => c.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
  async get(id: string) {
    const c = await this.repo.getCategory(id);
    if (!c) throw new CategoryNotFoundError(id);
    return c.toJSON();
  }
  async children(parentId: string, limit: number) {
    if (!(await this.repo.getCategory(parentId))) throw new CategoryNotFoundError(parentId);
    return this.list({ parentId, limit });
  }
  async history(q: Omit<ChangeListQuery, 'entityType'>) {
    if (!(await this.repo.getCategory(q.entityId))) throw new CategoryNotFoundError(q.entityId);
    const items = await this.repo.listChanges({ ...q, entityType: 'category' });
    const last = items[items.length - 1] as any;
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }

  /* ---------------- create ---------------- */
  async create(actor: AdminRequestContext, dto: CreateCategoryDto) {
    const slug = assertSlug(dto.slug);
    const defaultName = assertCategoryName(dto.defaultName);
    const commerceKind = assertCommerceKind(dto.commerceKind);
    const minAge = assertMinAge(dto.minAge ?? null);
    return this.pool.withTx(async (client) => {
      let parentCode: string | null = null; let parentDepth: number | null = null;
      const parentId = dto.parentId ?? null;
      if (parentId) {
        const parent = await this.repo.getCategoryForUpdate(client, parentId);
        if (!parent) throw new CategoryNotFoundError(parentId);
        if (!parent.isActive) throw new ParentInactiveError();
        parentCode = parent.code; parentDepth = parent.depth;
      }
      const code = deriveCode(parentCode, slug);
      const depth = deriveDepth(parentDepth);
      if (await this.repo.categoryCodeExists(client, code)) throw new DuplicateCatalogueCodeError('category', code);
      const ins = await this.repo.insertCategory(client, { parentId, code, defaultName, depth, commerceKind, requiresLicense: dto.requiresLicense, requiresCertificate: dto.requiresCertificate, minAge, sortOrder: dto.sortOrder, iconMediaId: dto.iconMediaId ?? null, actorUserId: actor.userId });
      const newValue = { id: ins.id, parentId, code, defaultName, path: ins.path, depth, commerceKind, requiresLicense: dto.requiresLicense, requiresCertificate: dto.requiresCertificate, minAge, sortOrder: dto.sortOrder, isActive: true };
      await this.repo.insertChange(client, { entityType: 'category', entityId: ins.id, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'catalogue.category.created', entityType: 'category', entityId: ins.id, oldValue: null, newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { ...newValue, createdAt: ins.createdAt };
    });
  }

  /* ---------------- update (rename + flags) ---------------- */
  async update(actor: AdminRequestContext, id: string, dto: UpdateCategoryDto) {
    return this.pool.withTx(async (client) => {
      const cat = await this.repo.getCategoryForUpdate(client, id);
      if (!cat) throw new CategoryNotFoundError(id);
      const change = cat.update({ defaultName: dto.defaultName, commerceKind: dto.commerceKind, requiresLicense: dto.requiresLicense, requiresCertificate: dto.requiresCertificate, minAge: dto.minAge, sortOrder: dto.sortOrder, iconMediaId: dto.iconMediaId });
      const p = cat.persist;
      await this.repo.updateCategory(client, id, { defaultName: p.defaultName, commerceKind: p.commerceKind, requiresLicense: p.requiresLicense, requiresCertificate: p.requiresCertificate, minAge: p.minAge, sortOrder: p.sortOrder, iconMediaId: p.iconMediaId, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'category', entityId: id, action: change.action, oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: `catalogue.category.${change.action}`, entityType: 'category', entityId: id, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return cat.toJSON();
    });
  }

  /* ---------------- move (reparent subtree) ---------------- */
  async move(actor: AdminRequestContext, id: string, dto: MoveCategoryDto) {
    return this.pool.withTx(async (client) => {
      const node = await this.repo.getCategoryForUpdate(client, id);
      if (!node) throw new CategoryNotFoundError(id);
      if ((dto.newParentId ?? null) === node.parentId) throw new InvalidCatalogueInputError('category is already under that parent');

      let newParentCode: string | null = null; let newParentDepth: number | null = null; let newParentPath: string | null = null;
      if (dto.newParentId) {
        const parent = await this.repo.getCategoryForUpdate(client, dto.newParentId);
        if (!parent) throw new CategoryNotFoundError(dto.newParentId);
        if (!parent.isActive) throw new ParentInactiveError();
        newParentCode = parent.code; newParentDepth = parent.depth; newParentPath = parent.path;
      }
      assertNoCycle(newParentPath, node.path);                        // new parent ∉ {node ∪ descendants}

      const slug = leafSlug(node.code);
      const newCode = deriveCode(newParentCode, slug);
      const newDepth = deriveDepth(newParentDepth);
      const depthDelta = newDepth - node.depth;
      if (await this.repo.categoryCodeExists(client, newCode)) throw new DuplicateCatalogueCodeError('category', newCode);

      const stats = await this.repo.subtreeStats(client, node.path);
      if (stats.count > MAX_SUBTREE_MOVE) throw new SubtreeTooLargeError(stats.count, MAX_SUBTREE_MOVE);
      assertMovedDepthWithinLimit(stats.maxDepth, depthDelta);        // deepest descendant must still fit ≤ 5

      await this.repo.moveSubtree(client, { oldPath: node.path, newPath: newCode, depthDelta, nodeId: id, newParentId: dto.newParentId ?? null, actorUserId: actor.userId });
      const oldValue = { parentId: node.parentId, code: node.code, path: node.path, depth: node.depth };
      const newValue = { parentId: dto.newParentId ?? null, code: newCode, path: newCode, depth: newDepth, subtreeSize: stats.count };
      await this.repo.insertChange(client, { entityType: 'category', entityId: id, action: 'moved', oldValue, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'catalogue.category.moved', entityType: 'category', entityId: id, oldValue, newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { id, ...newValue };
    });
  }

  /* ---------------- (de)activate ---------------- */
  async setActive(actor: AdminRequestContext, id: string, dto: SetActiveDto) {
    return this.pool.withTx(async (client) => {
      const cat = await this.repo.getCategoryForUpdate(client, id);
      if (!cat) throw new CategoryNotFoundError(id);
      if (!dto.isActive) {
        const active = await this.repo.countActiveChildren(client, id);
        if (active > 0) throw new CategoryHasActiveChildrenError(active);          // no orphaned active branch
      } else if (cat.parentId) {
        const parent = await this.repo.getCategory(cat.parentId);
        if (!parent || !parent.isActive) throw new ParentInactiveError();          // can't activate under an inactive parent
      }
      const change = cat.setActive(dto.isActive);   // throws CatalogueAlreadyInState on no-op
      await this.repo.setCategoryActive(client, id, cat.isActive, actor.userId);
      await this.repo.insertChange(client, { entityType: 'category', entityId: id, action: change.action, oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: `catalogue.category.${change.action}`, entityType: 'category', entityId: id, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return cat.toJSON();
    });
  }
}
