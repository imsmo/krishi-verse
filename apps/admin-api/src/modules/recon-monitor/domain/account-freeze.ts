// apps/admin-api/src/modules/recon-monitor/domain/account-freeze.ts · pure guards for the wallet-account freeze
// CONTROL. Freezing is NOT a ledger posting — no money moves, zero-sum is untouched (Law 2); it just flips the
// wallet_accounts.is_frozen guard the wallet engine honours to block further debits. The guards keep the action
// idempotent-safe: you can only freeze a not-frozen account and unfreeze a frozen one (else a typed 409).
import { InvalidFreezeStateError } from './recon-monitor.errors';

export type FreezeAction = 'freeze' | 'unfreeze';

/** Returns the next is_frozen value, or throws if the action is a no-op against the current state. */
export function applyFreeze(currentlyFrozen: boolean, action: FreezeAction): boolean {
  if (action === 'freeze') {
    if (currentlyFrozen) throw new InvalidFreezeStateError('account is already frozen');
    return true;
  }
  if (!currentlyFrozen) throw new InvalidFreezeStateError('account is not frozen');
  return false;
}
