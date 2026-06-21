// apps/admin-api/src/modules/global-catalogue-ops/domain/lookup.entity.ts · pure entities for the controlled-
// vocabulary registry (no I/O). LookupType is the vocabulary itself; LookupValue is one PLATFORM value under it
// (tenant_id IS NULL). The `code` is the stable, immutable reference key; only default_name/meta/sort_order and
// the is_active flag mutate. activate/deactivate reject a no-op so the audit trail only records real changes.
import { assertTypeName, assertValueName, assertSortOrder, assertMeta } from './lookup-vocab';
import { CatalogueAlreadyInStateError } from './catalogue.errors';

export interface LookupTypeProps { code: string; defaultName: string; isTenantExtendable: boolean; }
export class LookupType {
  private constructor(private p: LookupTypeProps) {}
  static rehydrate(p: LookupTypeProps): LookupType { return new LookupType(p); }
  get code(): string { return this.p.code; }
  rename(name: string): { old: { defaultName: string }; new: { defaultName: string } } {
    const old = this.p.defaultName; this.p.defaultName = assertTypeName(name);
    return { old: { defaultName: old }, new: { defaultName: this.p.defaultName } };
  }
  toJSON() { return { code: this.p.code, defaultName: this.p.defaultName, isTenantExtendable: this.p.isTenantExtendable }; }
}

export interface LookupValueProps {
  id: string; typeCode: string; code: string; defaultName: string;
  meta: Record<string, unknown>; sortOrder: number; isActive: boolean; createdAt?: Date | null;
}
export type LookupValuePatch = { defaultName?: string; meta?: Record<string, unknown>; sortOrder?: number };

export class LookupValue {
  private constructor(private p: LookupValueProps) {}
  static rehydrate(p: LookupValueProps): LookupValue { return new LookupValue(p); }
  get id(): string { return this.p.id; }
  get isActive(): boolean { return this.p.isActive; }

  /** Apply a partial update (code is IMMUTABLE). Returns the changed before/after slice; throws if nothing changes. */
  update(patch: LookupValuePatch): { action: 'updated' | 'renamed'; old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    let onlyName = true;
    if (patch.defaultName !== undefined) { const v = assertValueName(patch.defaultName); if (v !== this.p.defaultName) { old.defaultName = this.p.defaultName; next.defaultName = v; this.p.defaultName = v; } }
    if (patch.meta !== undefined) { const v = assertMeta(patch.meta); old.meta = this.p.meta; next.meta = v; this.p.meta = v; onlyName = false; }
    if (patch.sortOrder !== undefined) { const v = assertSortOrder(patch.sortOrder); if (v !== this.p.sortOrder) { old.sortOrder = this.p.sortOrder; next.sortOrder = v; this.p.sortOrder = v; } onlyName = false; }
    if (Object.keys(next).length === 0) throw new CatalogueAlreadyInStateError('lookup value', this.p.isActive);
    return { action: onlyName && next.defaultName !== undefined ? 'renamed' : 'updated', old, new: next };
  }

  setActive(to: boolean): { action: 'activated' | 'deactivated'; old: { isActive: boolean }; new: { isActive: boolean } } {
    if (this.p.isActive === to) throw new CatalogueAlreadyInStateError('lookup value', to);
    const from = this.p.isActive; this.p.isActive = to;
    return { action: to ? 'activated' : 'deactivated', old: { isActive: from }, new: { isActive: to } };
  }

  get persist(): { defaultName: string; meta: Record<string, unknown>; sortOrder: number; isActive: boolean } {
    return { defaultName: this.p.defaultName, meta: this.p.meta, sortOrder: this.p.sortOrder, isActive: this.p.isActive };
  }
  toJSON() {
    return { id: this.p.id, typeCode: this.p.typeCode, code: this.p.code, defaultName: this.p.defaultName, meta: this.p.meta, sortOrder: this.p.sortOrder, isActive: this.p.isActive, createdAt: this.p.createdAt ?? null };
  }
}
