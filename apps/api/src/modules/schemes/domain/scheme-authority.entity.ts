// modules/schemes/domain/scheme-authority.entity.ts · read-only VO for scheme_authorities.
// GLOBAL reference data (no tenant_id): ministries / state depts / bodies. Admin-authored (Law 11).
export interface SchemeAuthorityProps { id: string; defaultName: string; level: string; regionId: string | null; createdAt?: Date; }
export class SchemeAuthority {
  private constructor(private readonly props: SchemeAuthorityProps) {}
  static rehydrate(p: SchemeAuthorityProps): SchemeAuthority { return new SchemeAuthority(p); }
  get id() { return this.props.id; }
  toJSON() { const v = this.props; return { id: v.id, name: v.defaultName, level: v.level, regionId: v.regionId }; }
}
