// apps/mobile/src/features/payments/payments.api.ts · the add-money (wallet recharge) flow. Orchestrates the
// REAL money path: createIntent (idempotent) → open Razorpay checkout → poll our own payment status until
// terminal (the server's signed webhook is the authority; the client only reads status). Money is bigint
// minor-unit strings throughout (Law 2). Add-money is NOT offline-queued (a payment requires the live gateway).
import { apiClient } from '../../core/api/client';
import { openCheckout } from '../../core/payments/checkout';
import { paymentOutcome, isTerminal, type PaymentOutcome } from '../../core/payments/money';
import { newId } from '../../core/util/ids';

export interface AddMoneyResult { outcome: PaymentOutcome; paymentId?: string }

/** Add money to the wallet. `amountMinor` is paise (string). Returns the terminal outcome (or 'pending' if the
 * gateway confirmed but our webhook hasn't captured yet — the wallet will reflect it shortly). */
export async function addMoney(amountMinor: string, prefill?: { name?: string; contact?: string }): Promise<AddMoneyResult> {
  const client = apiClient();
  const intent = await client.payments.createIntent({ purpose: 'wallet_recharge', amountMinor }, newId());

  const checkout = await openCheckout({ gatewayOrderId: intent.gatewayOrderId, amountMinor, description: 'Wallet recharge', prefill });
  if (!checkout.ok) return { outcome: checkout.cancelled ? 'pending' : 'failed', paymentId: intent.paymentId };

  // User finished in the sheet — poll our authoritative status (webhook-driven) a few times.
  const final = await pollPaymentStatus(intent.paymentId);
  return { outcome: final, paymentId: intent.paymentId };
}

/** Poll GET /payments/:id until terminal or attempts exhausted. Network errors don't throw — they keep the
 * outcome 'pending' (the wallet reconciles once the webhook lands). */
export async function pollPaymentStatus(paymentId: string, attempts = 5, delayMs = 1500): Promise<PaymentOutcome> {
  for (let i = 0; i < attempts; i++) {
    try {
      const p = await apiClient().payments.get(paymentId);
      if (isTerminal(p.status)) return paymentOutcome(p.status);
    } catch { /* transient — keep polling */ }
    await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  return 'pending';
}
