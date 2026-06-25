# Runbook: payment/webhook mismatch or failure spike — SEV1

**Page source:** `CheckoutFailureSpike` / `DependencyErrorRateHigh{dep="razorpay"}`.
1. Check Razorpay status + our breaker state (`dep.call`/`dep.failure` on the golden-signals dashboard).
2. Forged/replayed webhooks are auto-rejected (signature + amount/currency guards + event-id dedup) — confirm
   they're being rejected, not accepted.
3. If Razorpay is degraded: it's degrade-not-die (capture confirms on webhook retry). Communicate; don't double-charge.
4. Amount/currency mismatch alerts = possible tamper attempt → security review.
5. Reconcile after recovery (`SUM(amount_minor)=0`).
