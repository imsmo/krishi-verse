# API Business Modules — WAVE 3 (Phase-3)

35 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## Module: `exports`  ·  PRD M23  ·  Priority Wave 3 · M
**Owns tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/exports/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/__tests__/exporter-registration.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/__tests__/exports.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/controllers/v1/documents.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/controllers/v1/exporters.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/controllers/v1/shipments.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/domain/compliance-requirement.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/domain/export-document.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/domain/export-shipment.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/domain/export-shipment.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/domain/exporter-registration.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/domain/exports.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/create-compliance-requirement.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/create-export-document.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/create-export-shipment.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/create-exporter-registration.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/query-compliance-requirement.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/query-export-document.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/query-export-shipment.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/query-exporter-registration.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/dto/update-exporter-registration.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/events/exports.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/exports.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/jobs/doc-checklist-reminders.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'doc-checklist-reminders' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/jobs/rcmc-expiry.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'rcmc-expiry' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/policies/exports.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/repositories/compliance-requirement.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/repositories/export-document.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/repositories/export-shipment.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/repositories/exporter-registration.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/services/compliance-requirement.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/services/export-document.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/services/export-shipment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 3 · M

### `apps/api/src/modules/exports/services/exporter-registration.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: exporter_registrations, export_shipments, export_documents, compliance_requirements.
- **DB tables:** exporter_registrations, export_shipments, export_documents, compliance_requirements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 3 · M
