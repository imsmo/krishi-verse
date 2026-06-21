// apps/admin-api/src/modules/schemes-registry-ops/domain/scheme.entity.ts · pure entity for a government scheme
// (no I/O). Mirrors the apps/api read shape. `code` is IMMUTABLE (the catalogue key the read path + application
// snapshots reference). Mutations are split by snapshot impact (Law 5-style discipline over a versioned row):
//   • updateMeta  (name / authority / category / source_url) — classification, NO version bump.
//   • setWindow   (application_window) — WHEN to apply, NO version bump.
//   • updateRules (eligibility / benefit / docs / regions / fee) — WHO is eligible + entitlement ⇒ BUMPS version,
//                 so already-submitted scheme_applications keep their snapshotted scheme_version intact (PRD R18).
// money (processing_fee_minor) is bigint minor units (Law 2); toJSON emits it as a STRING (never a float).
import { assertSchemeName, assertUuidOrNull, assertSourceUrl, assertJsonObject, assertUuidArray, assertWindow, assertFeeMinor } from './scheme-rules';
import { SchemeAlreadyInStateError } from './schemes-registry.errors';

export interface SchemeProps {
  id: string; code: string; defaultName: string; authorityId: string; categoryId: string;
  benefitSummary: Record<string, unknown>; eligibilityRules: Record<string, unknown>;
  requiredDocTypeIds: string[]; applicationWindow: Record<string, unknown> | null; applicableRegionIds: string[];
  processingFeeMinor: bigint; sourceUrl: string | null; version: number; isActive: boolean; createdAt?: Date | null;
}
export type SchemeMetaPatch = { defaultName?: string; authorityId?: string; categoryId?: string; sourceUrl?: string | null };
export type SchemeRulesPatch = { benefitSummary?: unknown; eligibilityRules?: unknown; requiredDocTypeIds?: unknown; applicableRegionIds?: unknown; processingFeeMinor?: string };

const j = (v: unknown) => JSON.stringify(v ?? null);

export class Scheme {
  private constructor(private p: SchemeProps) {}
  static rehydrate(p: SchemeProps): Scheme { return new Scheme(p); }
  get id(): string { return this.p.id; }
  get code(): string { return this.p.code; }
  get version(): number { return this.p.version; }
  get isActive(): boolean { return this.p.isActive; }
  get authorityId(): string { return this.p.authorityId; }
  get categoryId(): string { return this.p.categoryId; }

  /** Classification/identity edit — no version bump. authority/category FK existence is checked in the service. */
  updateMeta(patch: SchemeMetaPatch): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.defaultName !== undefined) { const v = assertSchemeName(patch.defaultName); if (v !== this.p.defaultName) { old.defaultName = this.p.defaultName; next.defaultName = v; this.p.defaultName = v; } }
    if (patch.authorityId !== undefined) { const v = assertUuidOrNull(patch.authorityId, 'authorityId')!; if (v !== this.p.authorityId) { old.authorityId = this.p.authorityId; next.authorityId = v; this.p.authorityId = v; } }
    if (patch.categoryId !== undefined) { const v = assertUuidOrNull(patch.categoryId, 'categoryId')!; if (v !== this.p.categoryId) { old.categoryId = this.p.categoryId; next.categoryId = v; this.p.categoryId = v; } }
    if (patch.sourceUrl !== undefined) { const v = assertSourceUrl(patch.sourceUrl); if (v !== this.p.sourceUrl) { old.sourceUrl = this.p.sourceUrl; next.sourceUrl = v; this.p.sourceUrl = v; } }
    if (Object.keys(next).length === 0) throw new SchemeAlreadyInStateError('scheme', this.p.isActive);
    return { old, new: next };
  }

  /** Eligibility/entitlement edit — BUMPS version (snapshot integrity). Throws if nothing actually changes. */
  updateRules(patch: SchemeRulesPatch): { old: Record<string, unknown>; new: Record<string, unknown>; version: number } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.benefitSummary !== undefined) { const v = assertJsonObject(patch.benefitSummary, 'benefit_summary'); if (j(v) !== j(this.p.benefitSummary)) { old.benefitSummary = this.p.benefitSummary; next.benefitSummary = v; this.p.benefitSummary = v; } }
    if (patch.eligibilityRules !== undefined) { const v = assertJsonObject(patch.eligibilityRules, 'eligibility_rules'); if (j(v) !== j(this.p.eligibilityRules)) { old.eligibilityRules = this.p.eligibilityRules; next.eligibilityRules = v; this.p.eligibilityRules = v; } }
    if (patch.requiredDocTypeIds !== undefined) { const v = assertUuidArray(patch.requiredDocTypeIds, 'required_doc_type_ids', 100); if (j(v) !== j(this.p.requiredDocTypeIds)) { old.requiredDocTypeIds = this.p.requiredDocTypeIds; next.requiredDocTypeIds = v; this.p.requiredDocTypeIds = v; } }
    if (patch.applicableRegionIds !== undefined) { const v = assertUuidArray(patch.applicableRegionIds, 'applicable_region_ids', 2000); if (j(v) !== j(this.p.applicableRegionIds)) { old.applicableRegionIds = this.p.applicableRegionIds; next.applicableRegionIds = v; this.p.applicableRegionIds = v; } }
    if (patch.processingFeeMinor !== undefined) { const v = assertFeeMinor(patch.processingFeeMinor); if (v !== this.p.processingFeeMinor) { old.processingFeeMinor = this.p.processingFeeMinor.toString(); next.processingFeeMinor = v.toString(); this.p.processingFeeMinor = v; } }
    if (Object.keys(next).length === 0) throw new SchemeAlreadyInStateError('scheme', this.p.isActive);
    this.p.version += 1; next.version = this.p.version;
    return { old, new: next, version: this.p.version };
  }

  /** Application-window edit — no version bump (WHEN to apply, not WHO/what). */
  setWindow(window: unknown): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const v = assertWindow(window);
    if (j(v) === j(this.p.applicationWindow)) throw new SchemeAlreadyInStateError('scheme', this.p.isActive);
    const old = { applicationWindow: this.p.applicationWindow }; this.p.applicationWindow = v;
    return { old, new: { applicationWindow: v } };
  }

  setActive(to: boolean): { action: 'activated' | 'deactivated'; old: { isActive: boolean }; new: { isActive: boolean } } {
    if (this.p.isActive === to) throw new SchemeAlreadyInStateError('scheme', to);
    const from = this.p.isActive; this.p.isActive = to;
    return { action: to ? 'activated' : 'deactivated', old: { isActive: from }, new: { isActive: to } };
  }

  get persist() {
    return {
      defaultName: this.p.defaultName, authorityId: this.p.authorityId, categoryId: this.p.categoryId,
      benefitSummary: this.p.benefitSummary, eligibilityRules: this.p.eligibilityRules, requiredDocTypeIds: this.p.requiredDocTypeIds,
      applicationWindow: this.p.applicationWindow, applicableRegionIds: this.p.applicableRegionIds,
      processingFeeMinor: this.p.processingFeeMinor.toString(), sourceUrl: this.p.sourceUrl, version: this.p.version, isActive: this.p.isActive,
    };
  }
  toJSON() {
    return {
      id: this.p.id, code: this.p.code, defaultName: this.p.defaultName, authorityId: this.p.authorityId, categoryId: this.p.categoryId,
      benefitSummary: this.p.benefitSummary, eligibilityRules: this.p.eligibilityRules, requiredDocTypeIds: this.p.requiredDocTypeIds,
      applicationWindow: this.p.applicationWindow, applicableRegionIds: this.p.applicableRegionIds,
      processingFeeMinor: this.p.processingFeeMinor.toString(), sourceUrl: this.p.sourceUrl, version: this.p.version, isActive: this.p.isActive, createdAt: this.p.createdAt ?? null,
    };
  }
}
