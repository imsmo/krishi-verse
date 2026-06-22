// modules/catalogue/domain/brand.entity.ts · GLOBAL brand the product master references (pure TS, no I/O).
// Read model in the tenant plane: brands are platform master data (no tenant_id) — browsed here, WRITTEN only in
// apps/admin-api (Law 11). `isVerified` lets the UI badge manufacturer-verified brands.
export interface BrandProps { id: string; defaultName: string; manufacturer: string | null; isVerified: boolean; createdAt?: Date | null; }

export class Brand {
  constructor(readonly props: BrandProps) {}
  get id(): string { return this.props.id; }
  toJSON() { return { id: this.props.id, defaultName: this.props.defaultName, manufacturer: this.props.manufacturer ?? null, isVerified: this.props.isVerified, createdAt: this.props.createdAt ?? null }; }
}
