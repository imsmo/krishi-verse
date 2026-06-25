# Runbook: SEV0 incident command + postmortem template

**SEV0 = money at risk, data breach, or total outage.** Roles: Incident Commander (coordinates), Ops (hands on
keys), Comms (statuspage/stakeholders), Scribe (timeline).
1. Declare in PagerDuty + incident channel. IC owns decisions; everyone else proposes.
2. **Contain before fixing** (freeze writes / kill-switch the feature flag / freeze accounts for money).
3. Comms cadence: statuspage + stakeholders every 30 min until mitigated.
4. Resolve → verify (reconciliation zero-sum for money; SLOs recovered).
## Postmortem (within 48h, blameless)
Timeline · impact (users/₹) · root cause · what detected it (which alert) · what we changed · action items (owners
+ dates) · did our SLO budget absorb it? Add a regression test for the root cause.
