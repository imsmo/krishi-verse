// modules/exports/domain/exporter-registration.entity.ts · the exporter_registrations aggregate.
// RCMC + IEC details (APEDA/MPEDA/Spices/Tea/Coffee). KYC of the cert doc is the media/KYC module's job
// (doc_id reference). No money. No version → repo locks FOR UPDATE.
import { ExportAuthority, DomainEvent, ExportsEventType } from './exports.events';
import { InvalidExporterError } from './exports.errors';

export interface ExporterRegistrationProps {
  id: string; tenantId: string; exporterUserId: string; authority: ExportAuthority; regNo: string; iecCode: string | null; validUntil: string | null; docId: string | null; createdAt?: Date;
}
export class ExporterRegistration {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ExporterRegistrationProps) {}
  static register(input: ExporterRegistrationProps): ExporterRegistration {
    if (!input.regNo) throw new InvalidExporterError('registration number required');
    const e = new ExporterRegistration(input);
    e.events.push({ type: ExportsEventType.ExporterRegistered, payload: { registrationId: e.props.id, exporterUserId: e.props.exporterUserId, authority: e.props.authority } });
    return e;
  }
  static rehydrate(props: ExporterRegistrationProps): ExporterRegistration { return new ExporterRegistration(props); }
  get id() { return this.props.id; }
  get exporterUserId() { return this.props.exporterUserId; }
  toProps(): Readonly<ExporterRegistrationProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  update(patch: Partial<Pick<ExporterRegistrationProps, 'iecCode' | 'validUntil' | 'docId'>>): void {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) continue; (this.props as any)[k] = v; changed = true; }
    if (changed) this.events.push({ type: ExportsEventType.ExporterUpdated, payload: { registrationId: this.props.id } });
  }
  toJSON() { const v = this.props; return { id: v.id, exporterUserId: v.exporterUserId, authority: v.authority, regNo: v.regNo, iecCode: v.iecCode, validUntil: v.validUntil, docId: v.docId, createdAt: v.createdAt }; }
}
