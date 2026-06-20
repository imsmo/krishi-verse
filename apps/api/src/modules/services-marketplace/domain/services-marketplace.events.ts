// modules/services-marketplace/domain/services-marketplace.events.ts · integration events (via outbox, Law 4).
export const ServicesEventType = {
  OfferingPublished: 'services.offering_published',
  OfferingUpdated:   'services.offering_updated',
  OfferingArchived:  'services.offering_archived',
  BookingRequested:  'services.booking_requested',
  BookingConfirmed:  'services.booking_confirmed',
  BookingStarted:    'services.booking_started',
  BookingCompleted:  'services.booking_completed',
  BookingFeePaid:    'services.booking_fee_paid',
  BookingCancelled:  'services.booking_cancelled',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const PRICING_MODELS = ['per_hour', 'per_day', 'per_unit', 'per_person', 'per_visit', 'fixed'] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];
export const OFFERING_STATUSES = ['draft', 'published', 'paused', 'archived'] as const;
export type OfferingStatus = (typeof OFFERING_STATUSES)[number];
