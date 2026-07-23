// apps/mobile/src/features/payments/payments.api.ts · the add-money (wallet recharge) flow. Orchestrates the
// REAL money path: createIntent (idempotent) → open Razorpay checkout → poll our own payment status until
// terminal (the server's signed webhook is the authority; the client only reads status). Money is bigint
// minor-unit strings throughout (Law 2). Add-money is NOT offline-queued (a payment requires the live gateway).
//
// DEV/local exception: when no real PSP is configured on the API (no Razorpay keys — the exact case for a
// founder/dev running locally), createIntent's `provider` comes back 'sandbox' instead of 'razorpay'
// (apps/api payments.module.ts only ever defaults to sandbox outside production). Opening the real Razorpay
// SDK against a fake `sbx_order_…` id would just throw ("razorpay key id not configured" or an SDK rejection),
// which is exactly the "Add money is temporarily unavailable" the founder saw. Instead we drive the server's
// dev-only sandbox completion (same signed-webhook path a real capture takes — the HMAC secret never reaches
// this client) so the wallet top-up loop is provable locally with no real keys. In production this branch is
// never taken: `provider` is always 'razorpay' there.
import { apiClient } from '../../core/api/client';
import { openCheckout } from '../../core/payments/checkout';
import { paymentOutcome, isTerminal, isSandboxProvider, type PaymentOutcome } from '../../core/payments/money';
import { newId } from '../../core/util/ids';

export interface AddMoneyResult { outcome: PaymentOutcome; paymentId?: string }

/** Add money to the wallet. `amountMinor` is paise (string). Returns the terminal outcome (or 'pending' if the
 * gateway confirmed but our webhook hasn't captured yet — the wallet will reflect it shortly). */
export async function addMoney(amountMinor: string, prefill?: { name?: string; contact?: string }): Promise<AddMoneyResult> {
  const client = apiClient();
  const intent = await client.payments.createIntent({ purpose: 'wallet_recharge', amountMinor }, newId());

  if (isSandboxProvider(intent.provider)) {
    const summary = await client.payments.devCompleteSandbox(intent.paymentId);
    return { outcome: paymentOutcome(summary.status), paymentId: intent.paymentId };
  }

  const checkout = await openCheckout({ gatewayOrderId: intent.gatewayOrderId, amountMinor, description: 'Wallet recharge', prefill });
  if (!checkout.ok) return { outcome: checkout.cancelled ? 'pending' : 'failed', paymentId: intent.paymentId };

  // User finished in the sheet — poll our authoritative status (webhook-driven) a few times.
  const final = await pollPaymentStatus(intent.paymentId);
  return { outcome: final, paymentId: intent.paymentId };
}

/** Pay for a placed order via the gateway (purpose 'direct_order', referencing the order). Same REAL path as
 * add-money: createIntent (idempotent) → Razorpay checkout → poll our authoritative status. Escrow is held
 * SERVER-SIDE on capture (the client never moves money — Law 11). `amountMinor` is paise (Law 2). */
export async function payForOrder(orderId: string, amountMinor: string, prefill?: { name?: string; contact?: string }): Promise<AddMoneyResult> {
  const client = apiClient();
  const intent = await client.payments.createIntent({ purpose: 'direct_order', amountMinor, referenceType: 'order', referenceId: orderId }, newId());
  const checkout = await openCheckout({ gatewayOrderId: intent.gatewayOrderId, amountMinor, description: 'Order payment', prefill });
  if (!checkout.ok) return { outcome: checkout.cancelled ? 'pending' : 'failed', paymentId: intent.paymentId };
  const final = await pollPaymentStatus(intent.paymentId);
  return { outcome: final, paymentId: intent.paymentId };
}

/** Pay for a placed order from the KV WALLET balance (screen 130). Idempotent (Law 3) server move; escrow is held
 * SERVER-SIDE (the client never moves money — Law 11). Returns 'success' on a terminal wallet capture, else
 * 'pending' so the order screen reconciles. Throws only on a hard error the screen should surface. */
export async function payOrderFromWallet(orderId: string): Promise<AddMoneyResult> {
  const res = await apiClient().orders.payFromWallet(orderId, newId());
  const outcome: PaymentOutcome = isTerminal(res.status) ? paymentOutcome(res.status) : 'pending';
  return { outcome, paymentId: res.paymentId };
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
