# On-call escalation matrix

| Severity | Trigger | First responder | Escalate (15m no-ack) | Then (30m) |
|----------|---------|-----------------|------------------------|-----------|
| **page (SEV0/1)** | any `severity: page` alert (target down, ledger imbalance, payment failure spike, SLO fast burn) | primary on-call (PagerDuty) | secondary on-call | engineering lead + incident commander |
| **money (SEV0)** | `WalletReconMismatch`, `WalletRpcErrors` | primary on-call | **freeze affected accounts** (admin-api recon-monitor) + finance lead | CTO |
| **ticket (SEV2/3)** | `severity: ticket` (memory pressure, replica lag, SMS budget) | triaged next business hours (Slack #kv-alerts) | — | — |

Money alerts (`money: "true"`) always page immediately (no grouping delay). Acks + timeline tracked in PagerDuty;
postmortem within 48h for any SEV0/1 (ops/runbooks/incident-sev0.md).
