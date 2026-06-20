// modules/traceability/domain/traceability.events.ts · integration events (via outbox) + vocab.
export const TraceEventType = {
  LotCreated:    'trace.lot_created',
  EventAppended: 'trace.event_appended',
  LotAnchored:   'trace.lot_anchored',
} as const;
export type TraceEventType = (typeof TraceEventType)[keyof typeof TraceEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

// The farm-to-fork journey step vocabulary (PRD §16.3). Forward-only, but steps may repeat/skip (real supply
// chains aren't strict), so this is an ALLOWED-CODES set, not a rigid machine — append-only is the invariant.
export const TRACE_STEPS = ['harvested', 'listed', 'sold', 'packed', 'picked', 'in_transit', 'delivered', 'recalled'] as const;
export type TraceStep = (typeof TRACE_STEPS)[number];
