// modules/equipment/domain/equipment-asset.entity.ts · the equipment_assets aggregate (CHC machinery).
// Owner-listed asset (tractor/harvester/…). status active|maintenance|retired. No version → repo FOR UPDATE.
import { AssetStatus, DomainEvent, EquipmentEventType } from './equipment.events';
import { EquipmentForbiddenError } from './equipment.errors';

export interface EquipmentAssetProps {
  id: string; tenantId: string; ownerUserId: string; categoryId: string; productId: string | null;
  regNo: string | null; yearOfMfg: number | null; engineHours: string | null; hpRating: number | null;
  baseAddressId: string | null; serviceRadiusKm: number; gpsDeviceRef: string | null; status: AssetStatus; createdAt?: Date;
}
export class EquipmentAsset {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: EquipmentAssetProps) {}
  static list(input: Omit<EquipmentAssetProps, 'status'> & { status?: AssetStatus }): EquipmentAsset {
    const a = new EquipmentAsset({ ...input, status: input.status ?? 'active' });
    a.events.push({ type: EquipmentEventType.AssetListed, payload: { assetId: a.props.id, ownerUserId: a.props.ownerUserId, categoryId: a.props.categoryId } });
    return a;
  }
  static rehydrate(props: EquipmentAssetProps): EquipmentAsset { return new EquipmentAsset(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get ownerUserId() { return this.props.ownerUserId; }
  get status() { return this.props.status; }
  get isBookable() { return this.props.status === 'active'; }
  toProps(): Readonly<EquipmentAssetProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  update(patch: Partial<Pick<EquipmentAssetProps, 'productId' | 'regNo' | 'yearOfMfg' | 'engineHours' | 'hpRating' | 'baseAddressId' | 'serviceRadiusKm' | 'gpsDeviceRef'>>): void {
    if (this.props.status === 'retired') throw new EquipmentForbiddenError('cannot edit a retired asset');
    let changed = false;
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; (this.props as any)[k] = v; changed = true; }
    if (changed) this.events.push({ type: EquipmentEventType.AssetUpdated, payload: { assetId: this.props.id } });
  }
  setStatus(status: AssetStatus): void {
    this.props.status = status;
    if (status === 'retired') this.events.push({ type: EquipmentEventType.AssetRetired, payload: { assetId: this.props.id } });
  }
  toJSON() { const v = this.props; return { id: v.id, ownerUserId: v.ownerUserId, categoryId: v.categoryId, productId: v.productId, regNo: v.regNo,
    yearOfMfg: v.yearOfMfg, engineHours: v.engineHours, hpRating: v.hpRating, baseAddressId: v.baseAddressId, serviceRadiusKm: v.serviceRadiusKm, status: v.status, createdAt: v.createdAt }; }
}
