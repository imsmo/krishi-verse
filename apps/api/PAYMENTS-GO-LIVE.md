# Payments go-live runbook — live Razorpay + RazorpayX (P0-4)

The payment code is complete and hardened: signature-verified webhooks (fail-closed), idempotent on the
delivery event-id, **amount AND currency** tamper guards, ledger-only money (Law 2), refund reversal, and a
reconciliation zero-sum check. This runbook is the **operational** flip to live money rails — run it with the
live Razorpay account once the platform is deployed (it can't be done from code).

> Money never leaves the double-entry ledger. The gateway only moves funds between the platform **Gateway** and
> **Escrow** accounts; nothing here writes ledger rows directly.

---

## 1. Live keys → Secrets Manager (never in git)

Put the **live** dashboard keys into the API's env secret (`krishiverse-prod/api/env`, synced by External Secrets):
```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=<live>
RAZORPAY_WEBHOOK_SECRET=<the secret you set on the Razorpay webhook, step 2>
PAYMENTS_DEFAULT_PROVIDER=razorpay
# money-OUT (payouts) — RazorpayX:
RAZORPAYX_KEY_ID=<live>
RAZORPAYX_KEY_SECRET=<live>
RAZORPAYX_ACCOUNT_NUMBER=<your RazorpayX account no>
RAZORPAYX_WEBHOOK_SECRET=<the secret on the payout webhook, step 2>
```
On boot, `assertProductionSecurity` **refuses to start** if `RAZORPAY_KEY_ID` is unset or any webhook secret is
weak/`sandbox-secret`, and **no sandbox gateway is registered in production** — so a misconfig can't quietly accept
fake money.

---

## 2. Register the webhooks (Razorpay dashboard → Settings → Webhooks)

| Webhook | URL | Active events |
|---------|-----|---------------|
| Pay-in | `https://api.krishiverse.ai/v1/payments/webhooks/razorpay` | `payment.captured`, `payment.failed`, `refund.processed` |
| Payout (RazorpayX) | `https://api.krishiverse.ai/v1/payments/webhooks/razorpay/payouts` | `payout.processed`, `payout.failed`, `payout.reversed` |

Set each webhook's **secret** to the value you stored in step 1. Razorpay signs the raw body with HMAC-SHA256 and
sends `x-razorpay-signature` (+ `x-razorpay-event-id`, which we use as the dedup key).

> The order `notes` carry `tenant_id` — set when the intent's order is created — so the unauthenticated webhook
> can resolve the tenant *only* from the signature-verified body.

---

## 3. The ₹1 live smoke test (do this before opening to users)

1. Create a real ₹1 order through the storefront/app checkout (a real card/UPI).
2. Pay it. Razorpay fires `payment.captured` → our webhook.
3. Verify:
   ```sql
   -- payment captured
   SELECT status, ledger_txn_id FROM payments ORDER BY created_at DESC LIMIT 1;       -- 'success'
   -- the capture txn nets to zero (double-entry)
   SELECT SUM(amount_minor) FROM ledger_entries WHERE txn_id = '<ledger_txn_id>';     -- 0
   -- escrow holds ₹1 = 100 paise
   SELECT cached_balance_minor FROM wallet_accounts WHERE owner_kind='platform' AND account_code='escrow';
   ```

## 4. Replay test (idempotency)
In the Razorpay dashboard, **resend** the same `payment.captured` event. It must be a **no-op**:
```sql
SELECT SUM(amount_minor) FROM ledger_entries;   -- unchanged; escrow balance unchanged
```
(Dedup is keyed on `x-razorpay-event-id`; a redelivery carries the same id.)

## 5. Refund test
Issue a refund (admin/dispute path). Verify the escrow leg reverses and the payment shows the refunded amount:
```sql
SELECT status, refunded_minor FROM payments WHERE id='<id>';
SELECT SUM(amount_minor) FROM ledger_entries;   -- still 0 (whole ledger nets to zero)
```

## 6. Payout round-trip (money-OUT)
Run a payout (or the weekly batch). RazorpayX returns async → our payout webhook posts the ledger move on
`payout.processed`, or **reverses** the reservation on `payout.failed`/`payout.reversed`. Confirm:
```sql
SELECT status FROM payouts ORDER BY created_at DESC LIMIT 1;   -- 'success' (or 'reversed' on failure)
```

## 7. Reconciliation (must report balanced)
The worker runs `ReconciliationService.runZeroSumCheck` on a schedule; trigger/inspect it:
```sql
SELECT kind, ok, mismatches FROM reconciliation_runs ORDER BY started_at DESC LIMIT 5;  -- ok=true, mismatches=[]
```

---

## Tamper / abuse guards already enforced (no action needed — just know they're there)
- **Forged signature** → `WebhookSignatureError` (401), money untouched.
- **Amount mismatch** (webhook amount ≠ payment) → `PaymentAmountMismatchError` (409), money untouched.
- **Currency mismatch** → `PaymentCurrencyMismatchError` (409), money untouched.
- **Replay** (same event id) → idempotent no-op.
- **Unknown order / wrong tenant** → ignored (no cross-tenant write).

## Done when
₹1 order pays → captures → escrow credited → reconciles to zero; a resent webhook is a no-op; a refund reverses
cleanly; a payout round-trips. All verifiable with the SQL above. Covered in CI by
`payments.integration.spec.ts` (capture→zero-sum→replay-noop→currency-guard→event-id-dedup→global-ledger-zero) and
`razorpay-gateway.spec.ts` (parse + signature). Run live with the real account per the steps above.
