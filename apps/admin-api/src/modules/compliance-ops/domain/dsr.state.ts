// apps/admin-api/src/modules/compliance-ops/domain/dsr.state.ts · the data_subject_requests.status state machine
// (Law 5 — the ONLY place DSR transitions are decided). Mirrors the CHECK in db/migrations/0003:
//   open → in_progress → completed | rejected.  completed/rejected are terminal. A DPDP rights request
//   (access/erasure/correction/portability) flows through this; an erasure additionally honours the 90-day
//   cooling window (cooling_ends_at) before it can be COMPLETED (enforced in the entity).
export const DSR_STATUSES = ['open', 'in_progress', 'completed', 'rejected'] as const;
export type DsrStatus = (typeof DSR_STATUSES)[number];

const TRANSITIONS: Readonly<Record<DsrStatus, readonly DsrStatus[]>> = Object.freeze({
  open:        ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed:   [],
  rejected:    [],
});

export class IllegalDsrTransitionError extends Error {
  readonly code = 'DSR_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move data-subject request ${from}→${to}`);
    this.name = 'IllegalDsrTransitionError';
  }
}
export function canTransition(from: DsrStatus, to: DsrStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: DsrStatus, to: DsrStatus): void {
  if (!canTransition(from, to)) throw new IllegalDsrTransitionError(from, to);
}
export function isTerminal(s: DsrStatus): boolean { return s === 'completed' || s === 'rejected'; }
