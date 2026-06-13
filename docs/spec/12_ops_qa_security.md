# Ops, QA & Security

56 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `alerts`

### `ops/alerts/api-alerts.yml` 
- **Layer:** Alert Rules
- **Implement:** Alert-as-code: API golden signals, wallet recon mismatch=page, DB/queue depth, SMS budget, business KPIs. 
- **Laws:** general
- **Priority:** see build plan

### `ops/alerts/business-alerts.yml` 
- **Layer:** Alert Rules
- **Implement:** Alert-as-code: API golden signals, wallet recon mismatch=page, DB/queue depth, SMS budget, business KPIs. 
- **Laws:** general
- **Priority:** see build plan

### `ops/alerts/db-alerts.yml` 
- **Layer:** Alert Rules
- **Implement:** Alert-as-code: API golden signals, wallet recon mismatch=page, DB/queue depth, SMS budget, business KPIs. 
- **Laws:** general
- **Priority:** see build plan

### `ops/alerts/queue-alerts.yml` 
- **Layer:** Alert Rules
- **Implement:** Alert-as-code: API golden signals, wallet recon mismatch=page, DB/queue depth, SMS budget, business KPIs. 
- **Laws:** general
- **Priority:** see build plan

### `ops/alerts/sms-budget-alerts.yml` 
- **Layer:** Alert Rules
- **Implement:** Alert-as-code: API golden signals, wallet recon mismatch=page, DB/queue depth, SMS budget, business KPIs. 
- **Laws:** general
- **Priority:** see build plan

### `ops/alerts/wallet-alerts.yml` 
- **Layer:** Alert Rules
- **Implement:** Alert-as-code: API golden signals, wallet recon mismatch=page, DB/queue depth, SMS budget, business KPIs. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money
- **Priority:** Wave 0/1


---
## `capacity-plan.md`

### `ops/capacity-plan.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `dashboards`

### `ops/dashboards/api-golden-signals.json` 
- **Layer:** Dashboard
- **Implement:** Dashboard-as-code (Datadog/Grafana) for the named signal set. 
- **Laws:** general
- **Priority:** see build plan

### `ops/dashboards/business-kpis.json` 
- **Layer:** Dashboard
- **Implement:** Dashboard-as-code (Datadog/Grafana) for the named signal set. 
- **Laws:** general
- **Priority:** see build plan

### `ops/dashboards/db-health.json` 
- **Layer:** Dashboard
- **Implement:** Dashboard-as-code (Datadog/Grafana) for the named signal set. 
- **Laws:** general
- **Priority:** see build plan

### `ops/dashboards/queue-depths.json` 
- **Layer:** Dashboard
- **Implement:** Dashboard-as-code (Datadog/Grafana) for the named signal set. 
- **Laws:** general
- **Priority:** see build plan

### `ops/dashboards/sms-spend.json` 
- **Layer:** Dashboard
- **Implement:** Dashboard-as-code (Datadog/Grafana) for the named signal set. 
- **Laws:** general
- **Priority:** see build plan

### `ops/dashboards/wallet-invariants.json` 
- **Layer:** Dashboard
- **Implement:** Dashboard-as-code (Datadog/Grafana) for the named signal set. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money
- **Priority:** Wave 0/1


---
## `load-tests`

### `ops/load-tests/k6-auction-burst.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** general
- **Priority:** see build plan

### `ops/load-tests/k6-billion-scale-model.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** general
- **Priority:** see build plan

### `ops/load-tests/k6-mcc-morning-peak.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** general
- **Priority:** see build plan

### `ops/load-tests/k6-order-flow.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `ops/load-tests/k6-payout-batch.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** Law2 BIGINT money
- **Priority:** see build plan

### `ops/load-tests/k6-realtime-sockets.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** general
- **Priority:** see build plan

### `ops/load-tests/soak-72h.js` 
- **Layer:** Load Test
- **Implement:** k6 scenario incl. billion-scale model (5M DAU, 100k txn/min, 1M sockets) with SLO assertions. 
- **Laws:** general
- **Priority:** see build plan


---
## `oncall`

### `ops/oncall/escalation-matrix.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `ops/oncall/rotation-schedule.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `runbooks`

### `ops/runbooks/README.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/incident-sev0.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/launch-day.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/oncall-rotation.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/partition-job-failed.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/payment-mismatch.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** Law2 BIGINT money
- **Priority:** see build plan

### `ops/runbooks/production-down.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/restore-drill.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/sms-cost-spike.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/tenant-leak-suspected.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** general
- **Priority:** see build plan

### `ops/runbooks/wallet-recon-mismatch.md` 
- **Layer:** Runbook
- **Implement:** Step-by-step incident procedure (written BEFORE launch): detect→contain→communicate→resolve→postmortem. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money
- **Priority:** Wave 0/1


---
## `statuspage.md`

### `ops/statuspage.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan


---
## `accessibility-checklist.md`

### `qa/accessibility-checklist.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `chaos`

### `qa/chaos/drills.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `device-matrix.md`

### `qa/device-matrix.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `release-checklist.md`

### `qa/release-checklist.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `test-strategy.md`

### `qa/test-strategy.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `uat`

### `qa/uat/ambassador-journey.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan

### `qa/uat/buyer-journey.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan

### `qa/uat/farmer-journey.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan

### `qa/uat/god-mode-journey.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan

### `qa/uat/tenant-admin-journey.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan

### `qa/uat/worker-journey.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `vernacular-test-plan.md`

### `qa/vernacular-test-plan.md` 
- **Layer:** QA Pack
- **Implement:** Test strategy / device matrix / vernacular plan / per-role UAT scripts / accessibility / release checklist / chaos drills. 
- **Laws:** general
- **Priority:** see build plan


---
## `access-review-quarterly.md`

### `security/access-review-quarterly.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `admin-access-policy.md`

### `security/admin-access-policy.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `bug-bounty-policy.md`

### `security/bug-bounty-policy.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `data-classification.md`

### `security/data-classification.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `dpdp-dpia-template.md`

### `security/dpdp-dpia-template.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan


---
## `incident-response-plan.md`

### `security/incident-response-plan.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `key-management.md`

### `security/key-management.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `pentest-scope.md`

### `security/pentest-scope.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `security.txt`

### `security/security.txt` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan


---
## `threat-model.md`

### `security/threat-model.md` 
- **Layer:** Security Pack
- **Implement:** Threat model / data classification / DPDP DPIA / access reviews / key mgmt / pentest scope / admin-access policy. 
- **Laws:** general
- **Priority:** see build plan
