// apps/admin-api/src/modules/recon-monitor/domain/investigation.state.ts · the recon-investigation status state
// machine (Law 5 — the ONLY place transitions are decided). A mismatch alert from a reconciliation_run becomes
// an investigation an operator works:  open → investigating → resolved | false_positive.  Resolved/false_positive
// are terminal. Mirrors the CHECK in db/migrations/0033.
export const INVESTIGATION_STATUSES = ['open', 'investigating', 'resolved', 'false_positive'] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

const TRANSITIONS: Readonly<Record<InvestigationStatus, readonly InvestigationStatus[]>> = Object.freeze({
  open:           ['investigating', 'resolved', 'false_positive'],
  investigating:  ['resolved', 'false_positive', 'open'],
  resolved:       [],
  false_positive: [],
});

export class IllegalInvestigationTransitionError extends Error {
  readonly code = 'RECON_INVESTIGATION_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move investigation ${from}→${to}`);
    this.name = 'IllegalInvestigationTransitionError';
  }
}
export function canTransition(from: InvestigationStatus, to: InvestigationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTransition(from: InvestigationStatus, to: InvestigationStatus): void {
  if (!canTransition(from, to)) throw new IllegalInvestigationTransitionError(from, to);
}
export function isTerminal(s: InvestigationStatus): boolean { return s === 'resolved' || s === 'false_positive'; }
