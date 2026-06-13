# Docs & CI/CD

32 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `adr`

### `docs/adr/0001-monorepo-modular-monolith.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/adr/0002-tenant-isolation-strategy.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/adr/0003-money-ledger-design.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `docs/adr/0004-outbox-over-dualwrite.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/adr/0005-one-mobile-app-role-switching.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/adr/0006-dynamic-master-data-vs-state-enums.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law5 sole state machine
- **Priority:** see build plan

### `docs/adr/0007-partitioning-and-shard-path.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** see build plan

### `docs/adr/0008-cell-per-country.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan


---
## `api`

### `docs/api/conventions.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/api/versioning.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan


---
## `architecture`

### `docs/architecture/00_Codebase_Structure_Guide.docx` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/architecture/billion-ops-readiness.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/architecture/cqrs-read-models.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** see build plan

### `docs/architecture/event-catalog.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** see build plan

### `docs/architecture/module-map.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law10 feature flag
- **Priority:** see build plan

### `docs/architecture/role-surface-matrix.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/architecture/scaling-ladder.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/architecture/service-extraction-plan.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `docs/architecture/system-overview.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan


---
## `build`

### `docs/build/00_BUILD_PLAN.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/build/01_AI_AGENT_BUILD_GUIDE.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/build/02_MODULE_TICKET_TEMPLATE.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/build/03_BUILD_STATE.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/build/04_EFFORT_AND_TEAM.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/build/Build_Readiness_Pack.docx` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan


---
## `legal`

### `docs/legal/partner-dpa-template.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `docs/legal/privacy-policy-template.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `docs/legal/tenant-msa-template.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `docs/legal/terms-of-service-template.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan


---
## `onboarding`

### `docs/onboarding/dev-setup.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan

### `docs/onboarding/first-week.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan


---
## `runbooks`

### `docs/runbooks/index.md` 
- **Layer:** Documentation
- **Implement:** Architecture/ADR/API/onboarding/legal/build docs. 
- **Laws:** general
- **Priority:** see build plan
