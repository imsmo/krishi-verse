// modules/exports/__tests__/exports-domain.spec.ts · pure-domain unit tests: the shipment + document state
// machines and the aggregates. The docs-cleared ship gate lives in the service (needs the doc repo) → see
// export-shipment.service.spec. No infra here.
import { canTransition as sCan, isTerminal, SHIPMENT_STATUSES, ShipmentStatus, IllegalShipmentTransitionError } from '../domain/export-shipment.state';
import { canTransition as dCan, isCleared, DOCUMENT_STATUSES, DocumentStatus } from '../domain/export-document.state';
import { ExportShipment } from '../domain/export-shipment.entity';
import { ExportDocument } from '../domain/export-document.entity';
import { ExporterRegistration } from '../domain/exporter-registration.entity';
import { ExportsEventType } from '../domain/exports.events';
import { InvalidExporterError } from '../domain/exports.errors';

const shipment = () => ExportShipment.create({ id: 's1', tenantId: 't1', exporterUserId: 'exp1', destinationCountry: 'US', incoterm: 'FOB', orderIds: [], vesselOrAwb: null, lcRef: null, totalValueMinor: 1000000n, currencyCode: 'USD' });

describe('export-shipment.state machine (linear lifecycle)', () => {
  it('draft→docs_in_progress→inspection→shipped→delivered→paid→closed', () => {
    expect(sCan('draft', 'docs_in_progress')).toBe(true);
    expect(sCan('docs_in_progress', 'inspection')).toBe(true);
    expect(sCan('inspection', 'shipped')).toBe(true);
    expect(sCan('shipped', 'delivered')).toBe(true);
    expect(sCan('delivered', 'paid')).toBe(true);
    expect(sCan('paid', 'closed')).toBe(true);
    expect(sCan('draft', 'shipped')).toBe(false);
    expect(isTerminal('closed')).toBe(true);
    for (const s of SHIPMENT_STATUSES) expect(() => sCan(s, 'closed' as ShipmentStatus)).not.toThrow();
    expect(new IllegalShipmentTransitionError('closed', 'draft').code).toBe('EXPORT_SHIPMENT_ILLEGAL_TRANSITION');
  });
  it('shipment advances through the chain emitting shipment_progressed', () => {
    const s = shipment(); s.pullEvents();
    s.advance('docs_in_progress'); s.advance('inspection');
    expect(s.status).toBe('inspection');
    expect(s.pullEvents().every((e) => e.type === ExportsEventType.ShipmentProgressed)).toBe(true);
    expect(() => s.advance('paid')).toThrow(IllegalShipmentTransitionError);   // can't skip
  });
});

describe('export-document.state machine', () => {
  it('pending→submitted→verified|rejected; rejected→submitted (resubmit)', () => {
    expect(dCan('pending', 'submitted')).toBe(true);
    expect(dCan('submitted', 'verified')).toBe(true);
    expect(dCan('submitted', 'rejected')).toBe(true);
    expect(dCan('rejected', 'submitted')).toBe(true);
    expect(dCan('verified', 'rejected')).toBe(false);
    expect(isCleared('verified')).toBe(true);
    for (const s of DOCUMENT_STATUSES) expect(() => dCan(s, 'submitted' as DocumentStatus)).not.toThrow();
  });
  it('document tracks status transitions + emits document_status_set', () => {
    const d = ExportDocument.add({ id: 'd1', shipmentId: 's1', tenantId: 't1', docTypeId: 'dt1', mediaId: null, referenceNo: null });
    d.pullEvents();
    d.setStatus('submitted', 'media1', 'CI-001'); d.setStatus('verified');
    expect(d.status).toBe('verified'); expect(d.toProps().mediaId).toBe('media1');
    expect(d.pullEvents().every((e) => e.type === ExportsEventType.DocumentStatusSet)).toBe(true);
  });
});

describe('ExporterRegistration', () => {
  it('requires a registration number; emits exporter_registered', () => {
    expect(() => ExporterRegistration.register({ id: 'e', tenantId: 't', exporterUserId: 'u', authority: 'APEDA', regNo: '', iecCode: null, validUntil: null, docId: null })).toThrow(InvalidExporterError);
    const e = ExporterRegistration.register({ id: 'e', tenantId: 't', exporterUserId: 'u', authority: 'APEDA', regNo: 'RCMC-1', iecCode: null, validUntil: null, docId: null });
    expect(e.pullEvents().map((x) => x.type)).toContain(ExportsEventType.ExporterRegistered);
  });
});
