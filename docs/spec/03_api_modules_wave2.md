# API Business Modules — WAVE 2 (Phase-2)

459 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## Module: `contract-farming`  ·  PRD M22  ·  Priority Wave 2 · M
**Owns tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/contract-farming/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/__tests__/contract-farming.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/__tests__/contract-template.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/contract-farming.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/controllers/v1/contracts.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/controllers/v1/growers.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/controllers/v1/milestones.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/contract-farming.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/contract-grower.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/contract-milestone.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/contract-template.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/farming-contract.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/farming-contract.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/domain/input-advance.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/create-contract-grower.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/create-contract-milestone.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/create-contract-template.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/create-farming-contract.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/create-input-advance.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/query-contract-grower.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/query-contract-milestone.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/query-contract-template.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/query-farming-contract.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/query-input-advance.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/dto/update-contract-template.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/events/contract-farming.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/jobs/milestone-due-reminders.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'milestone-due-reminders' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/policies/contract-farming.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/repositories/contract-grower.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/repositories/contract-milestone.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/repositories/contract-template.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/repositories/farming-contract.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/repositories/input-advance.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/services/contract-grower.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/services/contract-milestone.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/services/contract-template.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/services/farming-contract.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/contract-farming/services/input-advance.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances.
- **DB tables:** contract_templates, farming_contracts, contract_growers, contract_milestones, contract_input_advances
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M


---
## Module: `dairy`  ·  PRD M16  ·  Priority Wave 2 · XL
**Owns tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/dairy/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/__tests__/dairy.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/__tests__/mcc-centre.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/controllers/v1/collections.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/controllers/v1/coop.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/controllers/v1/d2c-subscriptions.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/controllers/v1/mcc.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/controllers/v1/milk-bills.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/controllers/v1/rate-cards.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dairy.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/bmc-unit.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/coop-resolution.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/coop-share.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/coop-vote.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/d2c-delivery.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/d2c-plan.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/d2c-subscription.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/d2c-subscription.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/dairy-membership.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/dairy.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/mcc-centre.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/milk-bill.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/milk-bill.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/milk-collection.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/domain/milk-rate-card.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/create-bmc-unit.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/create-dairy-membership.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/create-mcc-centre.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/create-milk-bill.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/create-milk-collection.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/create-milk-rate-card.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/query-bmc-unit.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/query-dairy-membership.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/query-mcc-centre.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/query-milk-bill.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/query-milk-collection.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/query-milk-rate-card.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/dto/update-mcc-centre.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/events/dairy.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/events/handlers/payout-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payout.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/jobs/adulteration-pattern-scan.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'adulteration-pattern-scan' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/jobs/bmc-temperature-watch.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'bmc-temperature-watch' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/jobs/d2c-route-plan.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'd2c-route-plan' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/jobs/daily-payout-run.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'daily-payout-run' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/jobs/milk-bill-cycle-close.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'milk-bill-cycle-close' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/policies/dairy.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/bmc-unit.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/coop-resolution.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/coop-share.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/coop-vote.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/d2c-delivery.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/d2c-plan.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/d2c-subscription.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/dairy-membership.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/mcc-centre.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/milk-bill.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/milk-collection.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/repositories/milk-rate-card.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/services/bmc-unit.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/services/dairy-membership.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/services/mcc-centre.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/services/milk-collection.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/dairy/services/milk-rate-card.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries.
- **DB tables:** mcc_centres, bmc_units, dairy_memberships, milk_rate_cards, milk_collections, milk_bills, coop_share_registers, coop_resolutions, coop_votes, subscription_plans_d2c, d2c_subscriptions, d2c_deliveries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL


---
## Module: `equipment`  ·  PRD M20/M25  ·  Priority Wave 2 · L
**Owns tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/equipment/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/__tests__/equipment-asset.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/__tests__/equipment.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/controllers/v1/drones.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/controllers/v1/equipment.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/controllers/v1/rentals.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/drone-flight.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/drone-pilot.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/drone-registration.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/equipment-asset.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/equipment-booking.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/equipment-booking.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/equipment-rate.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/equipment.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/domain/maintenance-log.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/create-drone-pilot.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/create-drone-registration.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/create-equipment-asset.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/create-equipment-booking.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/create-equipment-rate.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/create-maintenance-log.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/query-drone-pilot.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/query-drone-registration.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/query-equipment-asset.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/query-equipment-booking.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/query-equipment-rate.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/query-maintenance-log.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/dto/update-equipment-asset.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/equipment.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/events/equipment.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/jobs/booking-confirm-timeout.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'booking-confirm-timeout' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/jobs/dgca-licence-expiry.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'dgca-licence-expiry' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/jobs/insurance-rc-expiry-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'insurance-rc-expiry-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/policies/equipment.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/drone-flight.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/drone-pilot.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/drone-registration.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/equipment-asset.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/equipment-booking.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/equipment-rate.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/repositories/maintenance-log.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/services/drone-registration.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/services/equipment-asset.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/services/equipment-booking.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/services/equipment-rate.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/equipment/services/maintenance-log.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights.
- **DB tables:** equipment_assets, equipment_rates, equipment_bookings, equipment_maintenance_logs, drone_registrations, drone_pilots, drone_flights
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L


---
## Module: `fintech`  ·  PRD M19  ·  Priority Wave 2 · XL
**Owns tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/fintech/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/__tests__/financial-partner.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/__tests__/fintech.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/claims.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/credit-scores.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/groups.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/insurance.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/loan-applications.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/loan-products.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/loans.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/controllers/v1/partners.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/bnpl-limit.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/credit-score.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/finance-group.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/financial-partner.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/fintech.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/group-ledger-entry.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/insurance-claim.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/insurance-claim.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/insurance-policy.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/insurance-policy.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/insurance-product.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/loan-application.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/loan-application.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/loan-product.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/loan-repayment.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/loan.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/domain/loan.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/create-credit-score.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/create-financial-partner.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/create-loan-application.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/create-loan-product.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/create-loan-repayment.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/create-loan.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/query-credit-score.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/query-financial-partner.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/query-loan-application.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/query-loan-product.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/query-loan-repayment.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/query-loan.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/dto/update-financial-partner.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/events/fintech.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/events/handlers/milk-bill-paid.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'milk.bill.paid' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/events/handlers/weather-alert-issued.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'weather.alert.issued' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/fintech.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/jobs/default-early-warning.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'default-early-warning' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/jobs/emi-due-reminders.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'emi-due-reminders' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/jobs/parametric-trigger-scan.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'parametric-trigger-scan' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/jobs/partner-sla-report.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'partner-sla-report' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/policies/fintech.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/bnpl-limit.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/credit-score.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/finance-group.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/financial-partner.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/group-ledger-entry.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/insurance-claim.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/insurance-policy.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/insurance-product.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/loan-application.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/loan-product.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/loan-repayment.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/repositories/loan.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/services/credit-score.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/services/financial-partner.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/services/loan-application.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/services/loan-product.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/fintech/services/loan.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups.
- **DB tables:** financial_partners, credit_scores, credit_score_consents, loan_products, loan_applications, loans, loan_repayments, bnpl_limits, insurance_products, insurance_policies, insurance_claims, finance_groups, finance_group_members, group_ledger_entries
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL


---
## Module: `livestock`  ·  PRD M15  ·  Priority Wave 2 · XL
**Owns tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records, disease_outbreaks
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/livestock/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/__tests__/animal-species.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/__tests__/livestock.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/controllers/v1/animals.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/controllers/v1/breeding.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/controllers/v1/outbreaks.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/controllers/v1/vet-bookings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/controllers/v1/vets.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/animal-breed.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/animal-health-event.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/animal-species.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/animal.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/animal.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/disease-outbreak.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/insemination-record.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/livestock.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/ownership-transfer.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/prescription.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/semen-catalog.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/vet-booking.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/vet-booking.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/vet-profile.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/domain/vet-service.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/create-animal-breed.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/create-animal-health-event.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/create-animal-species.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/create-animal.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/create-ownership-transfer.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/create-vet-profile.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/query-animal-breed.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/query-animal-health-event.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/query-animal-species.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/query-animal.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/query-ownership-transfer.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/query-vet-profile.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/dto/update-animal-species.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/events/livestock.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/jobs/inaph-sync.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'inaph-sync' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/jobs/outbreak-geofence-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'outbreak-geofence-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/jobs/pd-due-bookings.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'pd-due-bookings' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/jobs/vaccination-reminders.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'vaccination-reminders' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/livestock.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/policies/livestock.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/animal-breed.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/animal-health-event.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/animal-species.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/animal.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/disease-outbreak.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/insemination-record.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/ownership-transfer.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/prescription.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/semen-catalog.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/vet-booking.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/vet-profile.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/repositories/vet-service.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/services/animal-breed.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/services/animal-health-event.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/services/animal-species.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/services/animal.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL

### `apps/api/src/modules/livestock/services/ownership-transfer.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items.
- **DB tables:** animal_species, animal_breeds, animals, animal_attribute_values, animal_health_events, animal_ownership_transfers, listing_animals, vet_profiles, vet_services, vet_bookings, prescriptions, prescription_items, semen_catalog, insemination_records
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · XL


---
## Module: `memberships`  ·  PRD revenue  ·  Priority Wave 2 · M
**Owns tables:** membership_tiers, user_memberships
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/memberships/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/__tests__/membership-tier.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/__tests__/memberships.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/controllers/v1/membership-tiers.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/controllers/v1/memberships.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/domain/membership-tier.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/domain/memberships.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/domain/user-membership.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/domain/user-membership.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/dto/create-membership-tier.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/dto/create-user-membership.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/dto/query-membership-tier.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/dto/query-user-membership.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/dto/update-membership-tier.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/events/memberships.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/jobs/membership-renewals.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'membership-renewals' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/memberships.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/policies/memberships.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/repositories/membership-tier.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/repositories/user-membership.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/services/membership-tier.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/memberships/services/user-membership.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: membership_tiers, user_memberships.
- **DB tables:** membership_tiers, user_memberships
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M


---
## Module: `promotions`  ·  PRD VAS  ·  Priority Wave 2 · M
**Owns tables:** promotions, coupons, coupon_redemptions
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/promotions/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/__tests__/promotion.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/__tests__/promotions.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/controllers/v1/coupons.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/controllers/v1/promotions.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/domain/coupon-redemption.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/domain/coupon.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/domain/promotion.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/domain/promotion.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/domain/promotions.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/create-coupon-redemption.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/create-coupon.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/create-promotion.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/query-coupon-redemption.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/query-coupon.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/query-promotion.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/dto/update-promotion.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/events/handlers/order-created.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.created' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/events/promotions.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/jobs/festival-campaign-scheduler.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'festival-campaign-scheduler' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/jobs/promo-budget-watch.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'promo-budget-watch' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/policies/promotions.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/promotions.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/repositories/coupon-redemption.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/repositories/coupon.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/repositories/promotion.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/services/coupon-redemption.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/services/coupon.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/promotions/services/promotion.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: promotions, coupons, coupon_redemptions.
- **DB tables:** promotions, coupons, coupon_redemptions
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M


---
## Module: `schemes`  ·  PRD M17  ·  Priority Wave 2 · L
**Owns tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/schemes/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/__tests__/scheme-authority.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/__tests__/schemes.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/controllers/v1/applications.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/controllers/v1/eligibility.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/controllers/v1/schemes.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/domain/dbt-transfer.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/domain/scheme-application.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/domain/scheme-application.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/domain/scheme-authority.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/domain/scheme.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/domain/schemes.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/create-dbt-transfer.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/create-scheme-application.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/create-scheme-authority.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/create-scheme.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/query-dbt-transfer.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/query-scheme-application.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/query-scheme-authority.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/query-scheme.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/dto/update-scheme-authority.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/events/schemes.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/jobs/pfms-sync.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'pfms-sync' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/jobs/scheme-rule-refresh.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'scheme-rule-refresh' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/jobs/stuck-application-escalation.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'stuck-application-escalation' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/jobs/window-open-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'window-open-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/policies/schemes.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/repositories/dbt-transfer.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/repositories/scheme-application.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/repositories/scheme-authority.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/repositories/scheme.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/schemes.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/services/dbt-transfer.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/services/scheme-application.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/services/scheme-authority.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L

### `apps/api/src/modules/schemes/services/scheme.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers.
- **DB tables:** scheme_authorities, schemes, scheme_applications, scheme_application_events, dbt_transfers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · L


---
## Module: `services-marketplace`  ·  PRD M27/M30  ·  Priority Wave 2 · M
**Owns tables:** service_offerings, service_bookings
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/services-marketplace/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/__tests__/service-offering.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/__tests__/services-marketplace.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/controllers/v1/bookings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/controllers/v1/offerings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/domain/service-booking.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/domain/service-booking.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/domain/service-offering.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/domain/services-marketplace.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/dto/create-service-booking.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/dto/create-service-offering.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/dto/query-service-booking.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/dto/query-service-offering.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/dto/update-service-offering.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/events/services-marketplace.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/jobs/booking-reminders.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'booking-reminders' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/policies/services-marketplace.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/repositories/service-booking.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/repositories/service-offering.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/services-marketplace.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/services/service-booking.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/services-marketplace/services/service-offering.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: service_offerings, service_bookings.
- **DB tables:** service_offerings, service_bookings
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M


---
## Module: `traceability`  ·  PRD §16.3  ·  Priority Wave 2 · M
**Owns tables:** trace_lots, trace_events
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/traceability/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/__tests__/trace-lot.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/__tests__/traceability.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/controllers/v1/public-scan.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/controllers/v1/trace-lots.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/domain/trace-event.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/domain/trace-lot.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/domain/traceability.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/dto/create-trace-event.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/dto/create-trace-lot.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/dto/query-trace-event.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/dto/query-trace-lot.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/dto/update-trace-lot.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/events/handlers/order-events-fanout.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.events.fanout' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/events/handlers/shipment-events-fanout.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'shipment.events.fanout' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/events/traceability.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/jobs/anchor-hashes.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'anchor-hashes' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/policies/traceability.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/repositories/trace-event.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/repositories/trace-lot.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/services/trace-event.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/services/trace-lot.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: trace_lots, trace_events.
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/traceability/traceability.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** trace_lots, trace_events
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M


---
## Module: `warehousing`  ·  PRD M21  ·  Priority Wave 2 · M
**Owns tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/warehousing/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/__tests__/warehouse.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/__tests__/warehousing.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/controllers/v1/nwr.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/controllers/v1/storage-bookings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/controllers/v1/warehouses.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/assay-report.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/nwr-receipt.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/nwr-receipt.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/storage-booking.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/storage-booking.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/warehouse.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/domain/warehousing.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/create-assay-report.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/create-nwr-receipt.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/create-storage-booking.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/create-warehouse.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/query-assay-report.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/query-nwr-receipt.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/query-storage-booking.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/query-warehouse.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/dto/update-warehouse.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/events/handlers/loan-disbursed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'loan.disbursed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/events/warehousing.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/jobs/nwr-mark-to-market.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'nwr-mark-to-market' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/jobs/reassay-due.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'reassay-due' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/policies/warehousing.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/repositories/assay-report.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/repositories/nwr-receipt.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/repositories/storage-booking.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/repositories/warehouse.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/services/assay-report.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/services/nwr-receipt.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/services/storage-booking.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/services/warehouse.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: warehouses, storage_bookings, assay_reports, nwr_receipts.
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 2 · M

### `apps/api/src/modules/warehousing/warehousing.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** warehouses, storage_bookings, assay_reports, nwr_receipts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 2 · M
