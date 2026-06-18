// modules/requirements/domain/requirements.events.ts · integration events (via outbox, Law 4).
export const RequirementEventType = {
  Posted:           'requirements.requirement_posted',
  PartiallyMatched: 'requirements.requirement_partially_matched',
  Fulfilled:        'requirements.requirement_fulfilled',
  Expired:          'requirements.requirement_expired',
  Closed:           'requirements.requirement_closed',
} as const;
export const ResponseEventType = {
  Submitted:   'requirements.response_submitted',
  Shortlisted: 'requirements.response_shortlisted',
  Accepted:    'requirements.quote_accepted',   // a quote is accepted → orders may create the order (downstream, Law 11)
  Rejected:    'requirements.response_rejected',
  Expired:     'requirements.response_expired',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };
