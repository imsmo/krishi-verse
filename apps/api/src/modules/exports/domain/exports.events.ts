// modules/exports/domain/exports.events.ts · integration events published by exports (via outbox, Law 4).
export const ExportsEventType = {
  ExporterRegistered:  'exports.exporter_registered',
  ExporterUpdated:     'exports.exporter_updated',
  ShipmentCreated:     'exports.shipment_created',
  ShipmentProgressed:  'exports.shipment_progressed',
  DocumentAdded:       'exports.document_added',
  DocumentStatusSet:   'exports.document_status_set',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const EXPORT_AUTHORITIES = ['APEDA', 'MPEDA', 'SPICES_BOARD', 'TEA', 'COFFEE'] as const;
export type ExportAuthority = (typeof EXPORT_AUTHORITIES)[number];
