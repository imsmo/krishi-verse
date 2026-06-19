// modules/warehousing/domain/warehouse.entity.ts · the warehouses aggregate (WDRA storage facility).
// tenant_id may be NULL (an independent WDRA warehouse listed on the open marketplace, cross-tenant
// visible). rate_per_qtl_month_minor is bigint minor units (Law 2). No version → repo locks FOR UPDATE.
import { DomainEvent, WarehousingEventType } from './warehousing.events';
import { InvalidWarehouseError } from './warehousing.errors';

export interface WarehouseProps {
  id: string; tenantId: string | null; operatorUserId: string | null; defaultName: string; wdraRegNo: string | null;
  addressId: string | null; capacityMt: string | null; storageKinds: string[]; commoditiesAccepted: string[];
  ratePerQtlMonthMinor: bigint | null; insurancePolicyRef: string | null; isActive: boolean; createdAt?: Date;
}
export class Warehouse {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: WarehouseProps) {}
  static list(input: Omit<WarehouseProps, 'isActive'> & { isActive?: boolean }): Warehouse {
    if (!input.defaultName) throw new InvalidWarehouseError('name required');
    if (input.ratePerQtlMonthMinor != null && input.ratePerQtlMonthMinor < 0n) throw new InvalidWarehouseError('rate cannot be negative');
    const w = new Warehouse({ ...input, isActive: input.isActive ?? true });
    w.events.push({ type: WarehousingEventType.WarehouseListed, payload: { warehouseId: w.props.id, operatorUserId: w.props.operatorUserId } });
    return w;
  }
  static rehydrate(props: WarehouseProps): Warehouse { return new Warehouse(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get operatorUserId() { return this.props.operatorUserId; }
  get ratePerQtlMonthMinor() { return this.props.ratePerQtlMonthMinor; }
  get isActive() { return this.props.isActive; }
  toProps(): Readonly<WarehouseProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  update(patch: Partial<Pick<WarehouseProps, 'defaultName' | 'wdraRegNo' | 'addressId' | 'capacityMt' | 'storageKinds' | 'commoditiesAccepted' | 'ratePerQtlMonthMinor' | 'insurancePolicyRef' | 'isActive' | 'operatorUserId'>>): void {
    if (patch.ratePerQtlMonthMinor != null && patch.ratePerQtlMonthMinor < 0n) throw new InvalidWarehouseError('rate cannot be negative');
    let changed = false;
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; (this.props as any)[k] = v; changed = true; }
    if (changed) this.events.push({ type: WarehousingEventType.WarehouseUpdated, payload: { warehouseId: this.props.id } });
  }
  toJSON() { const v = this.props; return { id: v.id, tenantId: v.tenantId, operatorUserId: v.operatorUserId, defaultName: v.defaultName, wdraRegNo: v.wdraRegNo,
    capacityMt: v.capacityMt, storageKinds: v.storageKinds, commoditiesAccepted: v.commoditiesAccepted, ratePerQtlMonthMinor: v.ratePerQtlMonthMinor?.toString() ?? null, isActive: v.isActive, createdAt: v.createdAt }; }
}
