// modules/auctions/domain/auction.state.ts · the auction_status state machine (Law 5).
// Mirrors the auction_status enum in db/migrations/0005_commerce.sql.
import { DomainError } from '../../../shared/errors/app-error';

export const AUCTION_STATUSES = ['scheduled', 'live', 'extended', 'ended', 'awaiting_approval', 'settled', 'cancelled', 'failed_reserve'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

const TRANSITIONS: Readonly<Record<AuctionStatus, readonly AuctionStatus[]>> = Object.freeze({
  scheduled:         ['live', 'cancelled'],
  live:              ['extended', 'ended', 'cancelled'],
  extended:          ['extended', 'ended', 'cancelled'],   // anti-snipe re-extends
  ended:             ['settled', 'awaiting_approval', 'failed_reserve'],
  awaiting_approval: ['settled', 'cancelled'],             // seller approves or rejects
  settled:           [],
  cancelled:         [],
  failed_reserve:    [],
});

export class IllegalAuctionTransitionError extends DomainError {
  constructor(from: string, to: string) { super('AUCTION_ILLEGAL_TRANSITION', `Cannot move auction ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: AuctionStatus, to: AuctionStatus): void { if (!canTransition(from, to)) throw new IllegalAuctionTransitionError(from, to); }
/** Bids are only accepted while live or (auto-)extended. */
export function isBiddable(s: AuctionStatus): boolean { return s === 'live' || s === 'extended'; }
export function isTerminal(s: AuctionStatus): boolean { return s === 'settled' || s === 'cancelled' || s === 'failed_reserve'; }
