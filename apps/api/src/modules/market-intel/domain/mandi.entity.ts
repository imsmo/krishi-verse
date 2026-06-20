// modules/market-intel/domain/mandi.entity.ts · a physical market (mandis, GLOBAL reference — no tenant_id).
// Read-only in this tenant module (authoring is platform/admin-api, Law 11). mandi_code = Agmarknet code.
export interface MandiProps {
  id: string; defaultName: string; regionId: string | null; mandiCode: string | null; lat: number | null; lng: number | null; isActive: boolean; createdAt?: Date;
}
export class Mandi {
  private constructor(private readonly props: MandiProps) {}
  static rehydrate(p: MandiProps): Mandi { return new Mandi(p); }
  get id() { return this.props.id; }
  toJSON() { const v = this.props; return { id: v.id, defaultName: v.defaultName, regionId: v.regionId, mandiCode: v.mandiCode, lat: v.lat, lng: v.lng, isActive: v.isActive }; }
}
