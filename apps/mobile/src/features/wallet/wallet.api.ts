// apps/mobile/src/features/wallet/wallet.api.ts · data layer for the farmer wallet vertical (P-06). Keeps screens
// thin (guide §3). Balance is the SERVER's truth (reconciled ledger) — the client only displays it, as a
// bigint-minor string (Law 2). Reads degrade-never-die (failure → empty/0 + a retry, never a crash). Money-OUT
// (withdrawal) is a REAL payout against the SDK, idempotent (Law 3), and is NOT offline-queued — a payout needs a
// live decision (balance/KYC/limits) the server owns, and the user needs an immediate outcome.
//
// FLAGGED BACKEND GAPS (built real where the endpoint exists; did NOT fake the rest):
//  • Balance read-model: GET /v1/wallet/balance is assumed (the wallet-service ledger is gRPC-internal; no HTTP
//    read-model is wired yet). We display it and degrade to ₹0+retry until it lands.
//  • There is NO unified wallet-ledger "transactions" endpoint. The real money movements the user CAN see are
//    payments (money-in) and payouts (money-out), so the Transactions screen lists payments and Payout history
//    lists payouts — both keyset-paged real endpoints. A single ledger-entry feed awaits a wallet read-model.
//  • Earnings (settlement credits) + spending-insights are now LIVE (P0-8): GET /v1/wallet/earnings and
//    /v1/wallet/spending-insights — the caller's OWN wallet, aggregated float-free (bigint-minor strings).
//  • UPI autopay mandates are now LIVE (P0-8): register / list / cancel against /v1/wallet/autopay. The actual
//    auto-debit COLLECTION still awaits a UPI-AutoPay PSP + webhook + worker (flagged in the API) — registering a
//    mandate records the standing instruction; it does not yet pull money.
//    Adding a bank/UPI payout destination (tokenised vaultRef) is the P-03 flagged gap — withdrawal works against
//    destinations already on file.
import type { PaymentSummary, PayoutSummary, BankAccount, WalletInsights, AutopayMandate } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

export interface Keyset<T> { items: T[]; nextCursor: string | null }

export async function walletBalance(): Promise<{ balanceMinor: string; failed: boolean }> {
  try {
    const r = await apiClient().request<{ balanceMinor: string }>('GET', 'wallet/balance');
    return { balanceMinor: r.data?.balanceMinor ?? '0', failed: false };
  } catch {
    return { balanceMinor: '0', failed: true };
  }
}

/** Transactions = the caller's payments (money-in). Keyset-paged; degrades to an empty page on failure. */
export async function listPayments(cursor?: string): Promise<Keyset<PaymentSummary>> {
  try { return await apiClient().payments.list(cursor); }
  catch { return { items: [], nextCursor: null }; }
}

/** Payout history (money-out / withdrawals). Keyset-paged; degrades to an empty page on failure. */
export async function listPayouts(cursor?: string): Promise<Keyset<PayoutSummary>> {
  try { return await apiClient().payouts.list(cursor); }
  catch { return { items: [], nextCursor: null }; }
}

export async function getPayment(id: string): Promise<PaymentSummary | null> {
  try { return await apiClient().payments.get(id); } catch { return null; }
}
export async function getPayout(id: string): Promise<PayoutSummary | null> {
  try { return await apiClient().payouts.get(id); } catch { return null; }
}

/** The caller's tokenised payout destinations (bank/UPI). Degrades to [] on failure. */
export async function listBankAccounts(): Promise<BankAccount[]> {
  try { return await apiClient().bankAccounts.list(); } catch { return []; }
}

/** Request a withdrawal from the wallet to a tokenised bank account. REAL + idempotent (Law 3). Throws on a real
 * error (insufficient balance / KYC-required 403 / network) so the screen can show a precise, friendly message —
 * the SERVER is the authority on whether it's allowed. `amountMinor` is paise (Law 2). */
export async function requestWithdrawal(amountMinor: string, bankAccountId: string): Promise<PayoutSummary> {
  return apiClient().payouts.request({ amountMinor, bankAccountId, purpose: 'wallet_withdrawal' }, newId());
}

// --- Money insights (P0-8, LIVE) — caller's OWN wallet, float-free bigint-minor strings. Degrade to a safe
// empty view on failure (read screens never crash). The window defaults to ~12 months server-side. ---
const EMPTY_INSIGHTS: WalletInsights = { fromIso: '', toIso: '', currencyCode: 'INR', totalMinor: '0', byMonth: [], byType: [] };

export async function walletEarnings(opts: { from?: string; to?: string } = {}): Promise<WalletInsights> {
  try { return await apiClient().wallet.earnings(opts); } catch { return EMPTY_INSIGHTS; }
}
export async function walletSpending(opts: { from?: string; to?: string } = {}): Promise<WalletInsights> {
  try { return await apiClient().wallet.spendingInsights(opts); } catch { return EMPTY_INSIGHTS; }
}

// --- UPI autopay mandates (P0-8, LIVE setup; auto-debit COLLECTION still PSP-gated) ---
export async function listAutopayMandates(cursor?: string): Promise<Keyset<AutopayMandate>> {
  try { return await apiClient().autopay.list(cursor); } catch { return { items: [], nextCursor: null }; }
}
/** Register a pending mandate. REAL + idempotent (Law 3). Throws on a real error so the screen shows a precise
 * message (e.g. a live mandate already exists for this purpose). The raw VPA is masked server-side — never logged. */
export async function registerAutopayMandate(input: { vpa: string; purpose: 'membership' | 'loan_emi' | 'general'; maxAmountMinor: string; frequency?: 'as_presented' | 'daily' | 'weekly' | 'monthly' }): Promise<AutopayMandate> {
  return apiClient().autopay.register(input, newId());
}
export async function cancelAutopayMandate(id: string, reason?: string): Promise<AutopayMandate> {
  return apiClient().autopay.cancel(id, reason);
}
