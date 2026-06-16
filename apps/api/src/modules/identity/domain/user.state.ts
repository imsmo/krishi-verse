// modules/identity/domain/user.state.ts · the ONLY place user_status transitions live (Law 5).
import { IllegalUserTransitionError } from './identity.errors';

export const USER_STATUSES = ['active','pending_verification','suspended','restricted','soft_deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const TRANSITIONS: Readonly<Record<UserStatus, readonly UserStatus[]>> = Object.freeze({
  pending_verification: ['active', 'soft_deleted'],
  active:               ['suspended', 'restricted', 'soft_deleted'],
  suspended:            ['active', 'soft_deleted'],
  restricted:           ['active', 'suspended', 'soft_deleted'],
  soft_deleted:         [], // terminal
});

export function canTransition(from: UserStatus, to: UserStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertUserTransition(from: UserStatus, to: UserStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) throw new IllegalUserTransitionError(from, to);
}
/** A user who may authenticate/transact. */
export function isLoginable(status: UserStatus): boolean {
  return status === 'active' || status === 'restricted';
}
