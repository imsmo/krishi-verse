// modules/warehousing/domain/warehousing.events.ts · integration events published by warehousing (outbox, Law 4).
export const WarehousingEventType = {
  WarehouseListed:   'warehousing.warehouse_listed',
  WarehouseUpdated:  'warehousing.warehouse_updated',
  BookingRequested:  'warehousing.booking_requested',
  BookingConfirmed:  'warehousing.booking_confirmed',
  BookingStored:     'warehousing.booking_stored',
  BookingReleased:   'warehousing.booking_released',   // storage fee settled
  BookingCancelled:  'warehousing.booking_cancelled',
  AssayRecorded:     'warehousing.assay_recorded',
  NwrIssued:         'warehousing.nwr_issued',
  NwrReleased:       'warehousing.nwr_released',
  NwrCancelled:      'warehousing.nwr_cancelled',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const STORAGE_KINDS = ['ambient', 'cold_0_4', 'frozen', 'ca'] as const;
export const NWR_REPOSITORIES = ['NERL', 'CCRL'] as const;
export type NwrRepository = (typeof NWR_REPOSITORIES)[number];
