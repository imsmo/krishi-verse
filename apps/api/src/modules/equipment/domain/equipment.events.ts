// modules/equipment/domain/equipment.events.ts · integration events published by equipment (outbox, Law 4).
export const EquipmentEventType = {
  AssetListed:      'equipment.asset_listed',
  AssetUpdated:     'equipment.asset_updated',
  AssetRetired:     'equipment.asset_retired',
  RateSet:          'equipment.rate_set',
  BookingRequested: 'equipment.booking_requested',
  BookingQuoted:    'equipment.booking_quoted',
  BookingConfirmed: 'equipment.booking_confirmed',     // advance escrowed
  BookingStarted:   'equipment.booking_started',       // OTP-gated
  BookingCompleted: 'equipment.booking_completed',
  BookingSettled:   'equipment.booking_settled',       // escrow released + remainder/refund
  BookingCancelled: 'equipment.booking_cancelled',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const RATE_BASES = ['per_hour', 'per_acre', 'per_day', 'per_job', 'per_km'] as const;
export type RateBasis = (typeof RATE_BASES)[number];
export const ASSET_STATUSES = ['active', 'maintenance', 'retired'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
