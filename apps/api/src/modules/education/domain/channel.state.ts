// modules/education/domain/channel.state.ts · STATE MACHINE for learning_channels.status (Law 5).
//   pending → approved | rejected ; approved ↔ suspended ; suspended → approved (reinstate) | rejected.
import { DomainError } from '../../../shared/errors/app-error';
import { ChannelStatus } from './creator.events';

const TRANSITIONS: Readonly<Record<ChannelStatus, readonly ChannelStatus[]>> = Object.freeze({
  pending:   ['approved', 'rejected'],
  approved:  ['suspended', 'rejected'],
  suspended: ['approved', 'rejected'],
  rejected:  [],
});
export class IllegalChannelTransitionError extends DomainError {
  constructor(from: string, to: string) { super('CHANNEL_ILLEGAL_TRANSITION', `Cannot move channel ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: ChannelStatus, to: ChannelStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: ChannelStatus, to: ChannelStatus): void { if (!canTransition(from, to)) throw new IllegalChannelTransitionError(from, to); }
export function isPublishable(s: ChannelStatus): boolean { return s === 'approved'; }
