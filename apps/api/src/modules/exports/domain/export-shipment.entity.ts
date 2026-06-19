// modules/exports/domain/export-shipment.entity.ts · the export_shipments aggregate root.
// Lifecycle via export-shipment.state. total_value_minor is bigint minor units (Law 2) — INFORMATIONAL
// only (export settlement is via LC/bank, external; 'paid' just records that confirmation). No in-platform
// wallet movement. The doc-cleared gate before 'shipped' is enforced by the service. No version → FOR UPDATE.
import { ShipmentStatus, assertTransition } from './export-shipment.state';
import { DomainEvent, ExportsEventType } from './exports.events';

export interface ExportShipmentProps {
  id: string; tenantId: string; exporterUserId: string; destinationCountry: string; incoterm: string | null; status: ShipmentStatus;
  orderIds: string[]; vesselOrAwb: string | null; lcRef: string | null; totalValueMinor: bigint | null; currencyCode: string; createdAt?: Date;
}
export class ExportShipment {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ExportShipmentProps) {}
  static create(input: Omit<ExportShipmentProps, 'status'>): ExportShipment {
    const s = new ExportShipment({ ...input, status: 'draft' });
    s.events.push({ type: ExportsEventType.ShipmentCreated, payload: { shipmentId: s.props.id, exporterUserId: s.props.exporterUserId, destinationCountry: s.props.destinationCountry } });
    return s;
  }
  static rehydrate(props: ExportShipmentProps): ExportShipment { return new ExportShipment(props); }
  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get exporterUserId() { return this.props.exporterUserId; }
  get status() { return this.props.status; }
  toProps(): Readonly<ExportShipmentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  /** Advance to the next lifecycle status (state machine is the only gate, Law 5). */
  advance(to: ShipmentStatus, extra: Record<string, unknown> = {}): void {
    const from = this.props.status; assertTransition(from, to); this.props.status = to;
    this.events.push({ type: ExportsEventType.ShipmentProgressed, payload: { shipmentId: this.props.id, from, to, ...extra } });
  }
  setShippingRefs(patch: { vesselOrAwb?: string | null; lcRef?: string | null }): void {
    if (patch.vesselOrAwb !== undefined) this.props.vesselOrAwb = patch.vesselOrAwb;
    if (patch.lcRef !== undefined) this.props.lcRef = patch.lcRef;
  }
  toJSON() { const v = this.props; return { id: v.id, exporterUserId: v.exporterUserId, destinationCountry: v.destinationCountry, incoterm: v.incoterm, status: v.status,
    orderIds: v.orderIds, vesselOrAwb: v.vesselOrAwb, lcRef: v.lcRef, totalValueMinor: v.totalValueMinor?.toString() ?? null, currencyCode: v.currencyCode, createdAt: v.createdAt }; }
}
