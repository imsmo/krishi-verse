// modules/dairy/domain/mcc-centre.entity.ts · the mcc_centres aggregate (a Milk Collection Centre).
// Tenant-owned infrastructure; UNIQUE(tenant_id, code). No version column → repo locks FOR UPDATE.
import { DomainEvent, DairyEventType } from './dairy.events';

export interface MccCentreProps {
  id: string; tenantId: string; code: string; defaultName: string; regionId: string | null;
  lat: string | null; lng: string | null; operatorUserId: string | null; capacityLitresShift: string | null;
  analyzerModel: string | null; analyzerSerial: string | null; isActive: boolean; createdAt?: Date;
}
export class MccCentre {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: MccCentreProps) {}
  static create(input: Omit<MccCentreProps, 'isActive' | 'createdAt'> & { isActive?: boolean }): MccCentre {
    const m = new MccCentre({ ...input, isActive: input.isActive ?? true });
    m.events.push({ type: DairyEventType.MccCreated, payload: { mccId: m.props.id, code: m.props.code } });
    return m;
  }
  static rehydrate(props: MccCentreProps): MccCentre { return new MccCentre(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  setActive(v: boolean) { this.props.isActive = v; }
  toProps(): Readonly<MccCentreProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { id: v.id, code: v.code, defaultName: v.defaultName, regionId: v.regionId, lat: v.lat, lng: v.lng,
    operatorUserId: v.operatorUserId, capacityLitresShift: v.capacityLitresShift, isActive: v.isActive, createdAt: v.createdAt }; }
}
