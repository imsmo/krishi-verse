// modules/livestock/domain/livestock.events.ts · integration events published by livestock (outbox, Law 4).
export const LivestockEventType = {
  AnimalRegistered:  'livestock.animal_registered',
  AnimalUpdated:     'livestock.animal_updated',
  AnimalRetired:     'livestock.animal_retired',       // sold | deceased | lost
  VetRegistered:     'livestock.vet_registered',
  VetServiceSet:     'livestock.vet_service_set',
  VetBookingRequested: 'livestock.vet_booking_requested',
  VetBookingAccepted:  'livestock.vet_booking_accepted',
  VetBookingProgressed:'livestock.vet_booking_progressed',
  VetBookingCompleted: 'livestock.vet_booking_completed',
  VetFeePaid:          'livestock.vet_fee_paid',
  VetBookingCancelled: 'livestock.vet_booking_cancelled',
  VetBookingNoShow:    'livestock.vet_booking_no_show',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const VET_SERVICE_PRICING_UNITS = ['per_visit', 'per_dose', 'per_animal', 'per_minute'] as const;
export type VetPricingUnit = (typeof VET_SERVICE_PRICING_UNITS)[number];
export const VET_BOOKING_MODES = ['visit', 'tele'] as const;
export const VET_BOOKING_URGENCIES = ['emergency', 'urgent', 'routine'] as const;
export const ANIMAL_RETIRE_REASONS = ['sold', 'deceased', 'lost'] as const;
export type AnimalRetireReason = (typeof ANIMAL_RETIRE_REASONS)[number];
