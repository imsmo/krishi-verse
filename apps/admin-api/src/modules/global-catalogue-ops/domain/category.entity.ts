// apps/admin-api/src/modules/global-catalogue-ops/domain/category.entity.ts · pure entity for a node in the
// category tree (no I/O). code/path/depth/parent are STRUCTURAL — they change only via a move (handled atomically
// in the repo/service over the whole subtree), never by a field patch. This entity owns the non-structural
// mutations (rename + flags) and the activate/deactivate guard (no-op rejected so audit records real changes).
import { assertCategoryName, assertCommerceKind, assertMinAge, CommerceKind } from './category-tree';
import { assertSortOrder } from './lookup-vocab';
import { CatalogueAlreadyInStateError } from './catalogue.errors';

export interface CategoryProps {
  id: string; parentId: string | null; code: string; defaultName: string; path: string; depth: number;
  commerceKind: CommerceKind | string; requiresLicense: boolean; requiresCertificate: boolean;
  minAge: number | null; isActive: boolean; sortOrder: number; iconMediaId: string | null; createdAt?: Date | null;
}
export type CategoryPatch = {
  defaultName?: string; commerceKind?: string; requiresLicense?: boolean; requiresCertificate?: boolean;
  minAge?: number | null; sortOrder?: number; iconMediaId?: string | null;
};

export class Category {
  private constructor(private p: CategoryProps) {}
  static rehydrate(p: CategoryProps): Category { return new Category(p); }
  get id(): string { return this.p.id; }
  get parentId(): string | null { return this.p.parentId; }
  get code(): string { return this.p.code; }
  get path(): string { return this.p.path; }
  get depth(): number { return this.p.depth; }
  get isActive(): boolean { return this.p.isActive; }

  /** Non-structural patch (rename + descriptive flags). Throws if nothing actually changes. */
  update(patch: CategoryPatch): { action: 'updated' | 'renamed'; old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.defaultName !== undefined) { const v = assertCategoryName(patch.defaultName); if (v !== this.p.defaultName) { old.defaultName = this.p.defaultName; next.defaultName = v; this.p.defaultName = v; } }
    if (patch.commerceKind !== undefined) { const v = assertCommerceKind(patch.commerceKind); if (v !== this.p.commerceKind) { old.commerceKind = this.p.commerceKind; next.commerceKind = v; this.p.commerceKind = v; } }
    if (patch.requiresLicense !== undefined && patch.requiresLicense !== this.p.requiresLicense) { old.requiresLicense = this.p.requiresLicense; next.requiresLicense = patch.requiresLicense; this.p.requiresLicense = patch.requiresLicense; }
    if (patch.requiresCertificate !== undefined && patch.requiresCertificate !== this.p.requiresCertificate) { old.requiresCertificate = this.p.requiresCertificate; next.requiresCertificate = patch.requiresCertificate; this.p.requiresCertificate = patch.requiresCertificate; }
    if (patch.minAge !== undefined) { const v = assertMinAge(patch.minAge); if (v !== this.p.minAge) { old.minAge = this.p.minAge; next.minAge = v; this.p.minAge = v; } }
    if (patch.sortOrder !== undefined) { const v = assertSortOrder(patch.sortOrder); if (v !== this.p.sortOrder) { old.sortOrder = this.p.sortOrder; next.sortOrder = v; this.p.sortOrder = v; } }
    if (patch.iconMediaId !== undefined && patch.iconMediaId !== this.p.iconMediaId) { old.iconMediaId = this.p.iconMediaId; next.iconMediaId = patch.iconMediaId; this.p.iconMediaId = patch.iconMediaId; }
    const onlyName = Object.keys(next).length === 1 && next.defaultName !== undefined;
    if (Object.keys(next).length === 0) throw new CatalogueAlreadyInStateError('category', this.p.isActive);
    return { action: onlyName ? 'renamed' : 'updated', old, new: next };
  }

  setActive(to: boolean): { action: 'activated' | 'deactivated'; old: { isActive: boolean }; new: { isActive: boolean } } {
    if (this.p.isActive === to) throw new CatalogueAlreadyInStateError('category', to);
    const from = this.p.isActive; this.p.isActive = to;
    return { action: to ? 'activated' : 'deactivated', old: { isActive: from }, new: { isActive: to } };
  }

  get persist(): { defaultName: string; commerceKind: string; requiresLicense: boolean; requiresCertificate: boolean; minAge: number | null; sortOrder: number; iconMediaId: string | null; isActive: boolean } {
    return { defaultName: this.p.defaultName, commerceKind: this.p.commerceKind, requiresLicense: this.p.requiresLicense, requiresCertificate: this.p.requiresCertificate, minAge: this.p.minAge, sortOrder: this.p.sortOrder, iconMediaId: this.p.iconMediaId, isActive: this.p.isActive };
  }
  toJSON() {
    return { id: this.p.id, parentId: this.p.parentId, code: this.p.code, defaultName: this.p.defaultName, path: this.p.path, depth: this.p.depth, commerceKind: this.p.commerceKind, requiresLicense: this.p.requiresLicense, requiresCertificate: this.p.requiresCertificate, minAge: this.p.minAge, isActive: this.p.isActive, sortOrder: this.p.sortOrder, iconMediaId: this.p.iconMediaId, createdAt: this.p.createdAt ?? null };
  }
}
