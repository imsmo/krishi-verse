// modules/education/domain/live-session.state.ts · STATE MACHINE for live_sessions.status (Law 5).
//   scheduled → live → ended ; scheduled → cancelled (a started session can't be cancelled, only ended).
import { DomainError } from '../../../shared/errors/app-error';
import { LiveStatus } from './creator.events';

const TRANSITIONS: Readonly<Record<LiveStatus, readonly LiveStatus[]>> = Object.freeze({
  scheduled: ['live', 'cancelled'],
  live:      ['ended'],
  ended:     [],
  cancelled: [],
});
export class IllegalLiveTransitionError extends DomainError {
  constructor(from: string, to: string) { super('LIVE_ILLEGAL_TRANSITION', `Cannot move live session ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: LiveStatus, to: LiveStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: LiveStatus, to: LiveStatus): void { if (!canTransition(from, to)) throw new IllegalLiveTransitionError(from, to); }
