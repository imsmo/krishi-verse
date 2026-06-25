# Runbook: SMS cost spike / OTP send failures

**Page source:** `SmsDailySpendNearBudget` / `SmsSendErrorRateHigh`.
1. Spike: check for an OTP-request loop / abuse (one phone hammered) — the per-phone request rate-limit should cap
   it; confirm it's engaged. Tighten `OTP_REQUEST_MAX_PER_HOUR` if needed.
2. Provider failing: OTP login is degraded → page. Failover `SMS_PROVIDER` (msg91↔twilio) via config + restart.
3. Budget breach: the daily budget guard should throttle non-critical SMS; OTP stays prioritised.
