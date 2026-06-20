// apps/mobile/src/features/kyc/bank.api.ts · bank-account (payout destination) data layer. Lists the caller's
// tokenised accounts (read, degrade) and adds one (idempotent). An account stores a gateway-tokenised `vaultRef`
// + last-4/IFSC only — the raw account number / VPA is tokenised at the gateway and NEVER sent here in the clear.
//
// FLAGGED BACKEND GAP: adding requires a `vaultRef` from a gateway fund-account tokenisation step that the app
// can't perform yet (no exposed tokenisation endpoint). So the bank-ADD screen is deferred to the payouts
// vertical (roadmap P-06) where that integration lands; listBanks() (read) is real and usable now.
import type { BankAccount } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

export async function listBanks(): Promise<BankAccount[]> {
  try { return await apiClient().bankAccounts.list(); }
  catch { return []; }
}

/** Add a tokenised payout destination. `vaultRef` must come from the gateway tokenisation step (see P-06). */
export async function addBank(input: { accountKind: 'bank' | 'upi'; vaultRef: string; upiId?: string; accountLast4?: string; ifsc?: string; holderName?: string; isPrimary?: boolean }): Promise<BankAccount> {
  return apiClient().bankAccounts.add(input, newId());
}
