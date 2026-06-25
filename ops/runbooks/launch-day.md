# Runbook: launch day

T-1 day: freeze non-critical deploys; confirm all six dashboards green; on-call armed; run `backup-verify.sh`.
T-0: enable user-facing feature flags gradually (default-OFF → on per kill-switch order); watch golden-signals +
wallet-invariants live; keep the ₹1 payment smoke + OTP login as canaries.
Rollback triggers: SLO fast-burn page, ledger mismatch, checkout-failure spike → flip the flag off / `helm rollback`.
War-room comms cadence: every 30 min for the first 4 hours.
