// apps/mobile/src/features/wallet/wallet.api.ts · data layer for the wallet balance tile. Keeps the screen thin
// (guide §3). Balance is the SERVER's truth (reconciled ledger) — the client only displays it, as a bigint-minor
// string (Law 2). Degrade-never-die: on failure returns balanceMinor '0' + failed=true so the screen shows a
// retry, never a crash. Assumed contract: GET /v1/wallet/balance → { data:{ balanceMinor } } (wallet read-model);
// replace with a typed SDK `wallet` resource when added (roadmap P-03/P-06).
import { apiClient } from '../../core/api/client';

export async function walletBalance(): Promise<{ balanceMinor: string; failed: boolean }> {
  try {
    const r = await apiClient().request<{ balanceMinor: string }>('GET', 'wallet/balance');
    return { balanceMinor: r.data?.balanceMinor ?? '0', failed: false };
  } catch {
    return { balanceMinor: '0', failed: true };
  }
}
