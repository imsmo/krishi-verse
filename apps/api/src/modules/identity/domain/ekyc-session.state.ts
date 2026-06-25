// modules/identity/domain/ekyc-session.state.ts · eKYC session lifecycle (Law 5: explicit state machine).
// A session is created 'pending' at start(); a verify() either moves it 'verified' (terminal, immutable) or, on a
// wrong/expired OTP, leaves it 'pending' until the attempt cap is hit → 'failed' (terminal). An expiry sweep moves
// stale 'pending' → 'expired' (terminal). Terminal states never transition again — a new verification starts fresh.
import { IllegalEkycTransitionError } from './identity.errors';

export const EKYC_SESSION_STATUSES = ['pending', 'verified', 'failed', 'expired'] as const;
export type EkycSessionStatus = (typeof EKYC_SESSION_STATUSES)[number];

/** Max failed OTP attempts before the session locks (→ failed). Abuse cap. */
export const EKYC_MAX_ATTEMPTS = 3;

const TRANSITIONS: Readonly<Record<EkycSessionStatus, readonly EkycSessionStatus[]>> = Object.freeze({
  pending:  ['verified', 'failed', 'expired'],
  verified: [],   // terminal
  failed:   [],   // terminal
  expired:  [],   // terminal
});

export function isTerminalEkyc(s: EkycSessionStatus): boolean {
  return TRANSITIONS[s].length === 0;
}
export function canEkycTransition(from: EkycSessionStatus, to: EkycSessionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertEkycTransition(from: EkycSessionStatus, to: EkycSessionStatus): void {
  if (!canEkycTransition(from, to)) throw new IllegalEkycTransitionError(from, to);
}
