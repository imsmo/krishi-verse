// modules/tenancy/domain/tenant-feature.entity.ts · a per-tenant feature OVERRIDE (0002 tenant_features). Pure TS.
// READ-ONLY in the self-serve plane: overrides (anchor deals / pilots / paid add-ons) are granted ONLY by the
// god-mode plane (apps/admin-api) — a tenant must never be able to switch on a paid/restricted feature for itself
// (Law 11, no privilege escalation). This entity therefore exposes only effective-state evaluation, no mutation.
export interface TenantFeatureProps { tenantId: string; featureCode: string; isEnabled: boolean; reason: string | null; expiresAt: Date | null; }

export class TenantFeature {
  private constructor(private p: TenantFeatureProps) {}
  static rehydrate(p: TenantFeatureProps): TenantFeature { return new TenantFeature(p); }

  /** Effective only when enabled AND not past its expiry (an expired override is inert). */
  isEffective(asOf: Date = new Date()): boolean { return this.p.isEnabled && (this.p.expiresAt === null || this.p.expiresAt.getTime() > asOf.getTime()); }
  toProps(): Readonly<TenantFeatureProps> { return Object.freeze({ ...this.p }); }
  toJSON() { return { featureCode: this.p.featureCode, isEnabled: this.p.isEnabled, effective: this.isEffective(), reason: this.p.reason, expiresAt: this.p.expiresAt }; }
}
