// modules/communication/domain/broadcast.state.ts · PURE state machine for a tenant broadcast (Law 5).
//   queued  → sending | failed
//   sending → sent | failed
// sent/failed are terminal. assertTransition throws a typed 409 on an illegal move.
import { DomainError } from '../../../shared/errors/app-error';

export const BROADCAST_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

const TRANSITIONS: Record<BroadcastStatus, BroadcastStatus[]> = {
  queued: ['sending', 'failed'],
  sending: ['sent', 'failed'],
  sent: [],
  failed: [],
};

export class IllegalBroadcastTransitionError extends DomainError {
  constructor(from: BroadcastStatus, to: BroadcastStatus) {
    super('BROADCAST_ILLEGAL_TRANSITION', `Cannot move broadcast from '${from}' to '${to}'`, 409, { from, to });
  }
}
export function canTransition(from: BroadcastStatus, to: BroadcastStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: BroadcastStatus, to: BroadcastStatus): void { if (!canTransition(from, to)) throw new IllegalBroadcastTransitionError(from, to); }
