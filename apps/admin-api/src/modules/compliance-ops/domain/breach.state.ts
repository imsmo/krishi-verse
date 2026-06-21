// apps/admin-api/src/modules/compliance-ops/domain/breach.state.ts · the data_breaches.status state machine
// (Law 5). DPDP §8 incident lifecycle: open → contained → notified → closed. A non-notifiable incident may go
// open→closed or contained→closed (closed without notification). closed is terminal. Mirrors the CHECK in
// db/migrations/0034.
export const BREACH_STATUSES = ['open', 'contained', 'notified', 'closed'] as const;
export type BreachStatus = (typeof BREACH_STATUSES)[number];

const TRANSITIONS: Readonly<Record<BreachStatus, readonly BreachStatus[]>> = Object.freeze({
  open:      ['contained', 'closed'],
  contained: ['notified', 'closed'],
  notified:  ['closed'],
  closed:    [],
});

export class IllegalBreachTransitionError extends Error {
  readonly code = 'BREACH_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move breach ${from}→${to}`);
    this.name = 'IllegalBreachTransitionError';
  }
}
export function canTransition(from: BreachStatus, to: BreachStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: BreachStatus, to: BreachStatus): void {
  if (!canTransition(from, to)) throw new IllegalBreachTransitionError(from, to);
}
export function isTerminal(s: BreachStatus): boolean { return s === 'closed'; }
