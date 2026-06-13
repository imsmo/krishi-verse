# God Mode (admin-api)

110 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `admin-api`

### `apps/admin-api/Dockerfile` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/README.md` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/package.json` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/admin.module.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/core/audit/admin-audit.interceptor.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law8 partition pruning, Law11 god-mode separate realm
- **Priority:** Wave 0/1

### `apps/admin-api/src/core/auth/admin-jwt.strategy.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** Wave 0/1

### `apps/admin-api/src/core/auth/hardware-key.guard.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** Wave 0/1

### `apps/admin-api/src/core/auth/ip-allowlist.middleware.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** Wave 0/1

### `apps/admin-api/src/core/auth/step-up-reauth.guard.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** Wave 0/1

### `apps/admin-api/src/core/rbac/owner-roles.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** Wave 0/1

### `apps/admin-api/src/main.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** see build plan


---
## `ai-models-ops`

### `apps/admin-api/src/modules/ai-models-ops/__tests__/ai-models-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/ai-models-ops/ai-models-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/ai-models-ops/ai-models-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/ai-models-ops/services/fairness-audit-reports.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/ai-models-ops/services/model-registry.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/ai-models-ops/services/threshold-tuning.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `announcements`

### `apps/admin-api/src/modules/announcements/__tests__/announcements.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/announcements/announcements.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/announcements/announcements.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/announcements/services/announcement-crud.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `billing-ops`

### `apps/admin-api/src/modules/billing-ops/__tests__/billing-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/billing-ops/billing-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/billing-ops/billing-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/billing-ops/services/dunning.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/billing-ops/services/manual-adjustment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/billing-ops/services/revenue-dashboard.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/billing-ops/services/saas-invoices-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `cells-ops`

### `apps/admin-api/src/modules/cells-ops/__tests__/cells-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/cells-ops/cells-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/cells-ops/cells-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/cells-ops/services/cell-registry.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/cells-ops/services/data-residency-rules.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/cells-ops/services/tenant-cell-assignment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `compliance-ops`

### `apps/admin-api/src/modules/compliance-ops/__tests__/compliance-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/compliance-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/compliance-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/services/audit-log-explorer.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/services/breach-response-console.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/services/data-subject-requests-queue.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/services/retention-policy-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/compliance-ops/services/tenant-export-approvals.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `flags-ops`

### `apps/admin-api/src/modules/flags-ops/__tests__/flags-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/flags-ops/flags-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/flags-ops/flags-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/flags-ops/services/global-flags.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/flags-ops/services/kill-switch.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/flags-ops/services/percent-rollout.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `global-catalogue-ops`

### `apps/admin-api/src/modules/global-catalogue-ops/__tests__/global-catalogue-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/global-catalogue-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/global-catalogue-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/services/attributes-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/services/categories-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/services/products-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/services/regulated-rules-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/global-catalogue-ops/services/synonyms-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `impersonation`

### `apps/admin-api/src/modules/impersonation/__tests__/impersonation.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/impersonation/impersonation.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/impersonation/impersonation.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/impersonation/services/end-impersonation.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/impersonation/services/impersonation-history.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/impersonation/services/start-impersonation.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `plans-ops`

### `apps/admin-api/src/modules/plans-ops/__tests__/plans-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/plans-ops/plans-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/plans-ops/plans-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/plans-ops/services/custom-pricing.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/plans-ops/services/plan-assignment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/plans-ops/services/plan-crud.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `platform-reports`

### `apps/admin-api/src/modules/platform-reports/__tests__/platform-reports.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/platform-reports/platform-reports.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/platform-reports/platform-reports.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/platform-reports/services/cohort-reports.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/platform-reports/services/cross-tenant-analytics.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/platform-reports/services/gmv-rollups.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/platform-reports/services/regulator-exports.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `providers-ops`

### `apps/admin-api/src/modules/providers-ops/__tests__/providers-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/providers-ops/providers-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/providers-ops/providers-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/providers-ops/services/financial-partners-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/providers-ops/services/integration-providers-admin.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/providers-ops/services/provider-sla-monitor.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `recon-monitor`

### `apps/admin-api/src/modules/recon-monitor/__tests__/recon-monitor.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/recon-monitor/recon-monitor.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/recon-monitor/recon-monitor.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/recon-monitor/services/ledger-freeze-controls.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/recon-monitor/services/mismatch-investigations.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/recon-monitor/services/wallet-recon-dashboard.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** Wave 0/1


---
## `schemes-registry-ops`

### `apps/admin-api/src/modules/schemes-registry-ops/__tests__/schemes-registry-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/schemes-registry-ops/schemes-registry-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/schemes-registry-ops/schemes-registry-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/schemes-registry-ops/services/eligibility-rules-editor.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/schemes-registry-ops/services/scheme-crud.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/schemes-registry-ops/services/window-calendar.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `support-oversight`

### `apps/admin-api/src/modules/support-oversight/__tests__/support-oversight.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/support-oversight/services/sla-breach-monitor.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/support-oversight/services/tenant-health-alerts.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/support-oversight/services/ticket-escalations.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/support-oversight/support-oversight.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/support-oversight/support-oversight.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `tenant-ops`

### `apps/admin-api/src/modules/tenant-ops/__tests__/impersonation-audit.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law8 partition pruning, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/__tests__/tenant-ops.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/services/approve-tenant.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/services/archive-tenant.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/services/override-limits.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/services/suspend-tenant.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/services/tenant-scorecard.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/services/tenant-search.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/tenant-ops.controller.ts` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan

### `apps/admin-api/src/modules/tenant-ops/tenant-ops.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law11 god-mode separate realm
- **Priority:** see build plan


---
## `admin-api`

### `apps/admin-api/tsconfig.json` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** Wave 0/1
