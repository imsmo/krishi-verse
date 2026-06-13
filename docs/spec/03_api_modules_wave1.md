# API Business Modules — WAVE 1 (Phase-1 MVP)

843 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## Module: `ai-governance`  ·  PRD §8.3  ·  Priority Wave 1 · M
**Owns tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/ai-governance/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/__tests__/ai-governance.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/__tests__/ai-model.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/ai-governance.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/controllers/v1/models.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/controllers/v1/review-queue.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/domain/ai-governance.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/domain/ai-inference.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/domain/ai-model.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/domain/ai-review.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/domain/ai-review.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/create-ai-inference.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/create-ai-model.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/create-ai-review.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/query-ai-inference.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/query-ai-model.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/query-ai-review.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/dto/update-ai-model.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/events/ai-governance.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/jobs/drift-watch.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'drift-watch' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/jobs/fairness-audit-monthly.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'fairness-audit-monthly' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/policies/ai-governance.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/repositories/ai-inference.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/repositories/ai-model.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/repositories/ai-review.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/services/ai-inference.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/services/ai-model.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ai-governance/services/ai-review.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ai_models, ai_inferences, ai_review_queue, moderation_reports.
- **DB tables:** ai_models, ai_inferences, ai_review_queue, moderation_reports
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `ambassadors`  ·  PRD §16.10  ·  Priority Wave 1 · M
**Owns tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/ambassadors/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/__tests__/ambassador-profile.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/__tests__/ambassadors.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/ambassadors.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/controllers/v1/ambassadors.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/controllers/v1/earnings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/controllers/v1/referrals.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/domain/ambassador-earning.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/domain/ambassador-profile.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/domain/ambassadors.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/domain/commission-plan.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/domain/referral.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/domain/referral.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/create-ambassador-earning.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/create-ambassador-profile.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/create-commission-plan.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/create-referral.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/query-ambassador-earning.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/query-ambassador-profile.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/query-commission-plan.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/query-referral.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/dto/update-ambassador-profile.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/events/ambassadors.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/events/handlers/user-onboarded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'user.onboarded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/events/handlers/worker-onboarded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'worker.onboarded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/jobs/inactivity-watch.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'inactivity-watch' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/jobs/milestone-bonuses.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'milestone-bonuses' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/jobs/weekly-payout-batch.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'weekly-payout-batch' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/policies/ambassadors.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/repositories/ambassador-earning.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/repositories/ambassador-profile.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/repositories/commission-plan.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/repositories/referral.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/services/ambassador-earning.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/services/ambassador-profile.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/services/commission-plan.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/ambassadors/services/referral.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals.
- **DB tables:** ambassador_profiles, commission_plans_ambassador, ambassador_earnings, referrals
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `auctions`  ·  PRD M04  ·  Priority Wave 1 · L
**Owns tables:** auctions, bids, auction_events, auction_watchers
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/auctions/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/__tests__/auction.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/__tests__/auctions.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/auctions.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/controllers/v1/auctions.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/controllers/v1/bids.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/domain/auction-watcher.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/domain/auction.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/domain/auction.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/domain/auctions.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/domain/bid.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/create-auction-watcher.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/create-auction.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/create-bid.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/query-auction-watcher.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/query-auction.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/query-bid.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/dto/update-auction.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/events/auctions.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/jobs/close-ended-auctions.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'close-ended-auctions' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/jobs/open-scheduled-auctions.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'open-scheduled-auctions' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/jobs/release-losing-emd.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'release-losing-emd' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/policies/auctions.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/read-models/auction-live.read-model.ts` 
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/repositories/auction-watcher.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/repositories/auction.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/repositories/bid.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/services/auction-watcher.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/services/auction.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/auctions/services/bid.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: auctions, bids, auction_events, auction_watchers.
- **DB tables:** auctions, bids, auction_events, auction_watchers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L


---
## Module: `catalogue`  ·  PRD M02-03  ·  Priority Wave 1 · M
**Owns tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/catalogue/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/__tests__/catalogue.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/__tests__/category.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/catalogue.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/controllers/v1/attributes.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/controllers/v1/batches.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/controllers/v1/categories.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/controllers/v1/certificates.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/controllers/v1/products.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/attribute-definition.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/attribute-option.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/attribute-template.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/brand.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/catalogue.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law6 dynamic data not code, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/category-attribute.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/category.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/certificate.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/certificate.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/product-batch.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/product.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/domain/regulated-rule.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/create-attribute-definition.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/create-attribute-option.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/create-attribute-template.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/create-category-attribute.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/create-category.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/create-product.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/query-attribute-definition.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/query-attribute-option.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/query-attribute-template.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/query-category-attribute.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/query-category.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/query-product.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/dto/update-category.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/events/catalogue.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law6 dynamic data not code, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/jobs/batch-expiry-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'batch-expiry-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/jobs/certificate-expiry-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'certificate-expiry-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/policies/catalogue.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/attribute-definition.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/attribute-option.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/attribute-template.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/brand.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/category-attribute.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/category.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/certificate.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/product-batch.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/product.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/repositories/regulated-rule.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/services/attribute-definition.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/services/attribute-option.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/services/attribute-template.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/services/category-attribute.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/catalogue/services/category.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates.
- **DB tables:** categories, tenant_categories, attribute_definitions, attribute_options, category_attributes, attribute_templates, brands, products, product_attribute_values, regulated_product_rules, product_batches, certificates, search_synonyms
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `cms`  ·  PRD M14  ·  Priority Wave 1 · S
**Owns tables:** cms_pages, banners
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/cms/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/__tests__/cms-page.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/__tests__/cms.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/cms.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/controllers/v1/banners.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/controllers/v1/pages.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/domain/banner.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/domain/cms-page.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/domain/cms-page.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/domain/cms.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/dto/create-banner.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/dto/create-cms-page.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/dto/query-banner.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/dto/query-cms-page.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/dto/update-cms-page.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/events/cms.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/jobs/banner-schedule.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'banner-schedule' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/policies/cms.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/repositories/banner.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/repositories/cms-page.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law7 i18n keys, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/services/banner.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/cms/services/cms-page.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: cms_pages, banners.
- **DB tables:** cms_pages, banners
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S


---
## Module: `communication`  ·  PRD M13  ·  Priority Wave 1 · M
**Owns tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/communication/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/__tests__/communication.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/__tests__/conversation.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/communication.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/controllers/v1/conversations.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/controllers/v1/messages.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/controllers/v1/preferences.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/controllers/v1/templates.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/communication.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/conversation.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/masked-call.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/message.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/notification-event.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/notification-preference.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/domain/notification-template.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/create-conversation.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/create-masked-call.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/create-message.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/create-notification-event.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/create-notification-preference.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/create-notification-template.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/query-conversation.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/query-masked-call.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/query-message.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/query-notification-event.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/query-notification-preference.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/query-notification-template.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/dto/update-conversation.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/events/communication.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/events/handlers/all-domain-events-fanout.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'all.domain.events.fanout' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/jobs/digest-batching.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'digest-batching' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/jobs/quiet-hours-scheduler.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'quiet-hours-scheduler' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/policies/communication.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/repositories/conversation.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/repositories/masked-call.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/repositories/message.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/repositories/notification-event.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/repositories/notification-preference.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/repositories/notification-template.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law6 dynamic data not code, Law7 i18n keys, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/services/conversation.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/services/masked-call.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/services/message.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/services/notification-event.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/communication/services/notification-template.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications.
- **DB tables:** conversations, conversation_participants, messages, masked_calls, notification_events, notification_templates, notification_preferences, user_quiet_hours, notifications
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `disputes`  ·  PRD M13/trust  ·  Priority Wave 1 · M
**Owns tables:** disputes, dispute_messages, returns
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/disputes/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/__tests__/dispute.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/__tests__/disputes.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/controllers/v1/disputes.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/controllers/v1/returns.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/disputes.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/domain/dispute-message.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/domain/dispute.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/domain/dispute.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/domain/disputes.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/domain/return.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/domain/return.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/create-dispute-message.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/create-dispute.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/create-return.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/query-dispute-message.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/query-dispute.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/query-return.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/dto/update-dispute.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/events/disputes.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/events/handlers/order-delivered.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.delivered' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/jobs/seller-response-timeout.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'seller-response-timeout' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/jobs/sla-escalation.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'sla-escalation' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/policies/disputes.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/repositories/dispute-message.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/repositories/dispute.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/repositories/return.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/services/dispute-message.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/services/dispute.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/disputes/services/return.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: disputes, dispute_messages, returns.
- **DB tables:** disputes, dispute_messages, returns
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `education`  ·  PRD M09  ·  Priority Wave 1 · M
**Owns tables:** instructors, courses, course_lessons, enrollments, lesson_progress
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/education/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/__tests__/education.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/__tests__/instructor.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/controllers/v1/courses.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/controllers/v1/enrollments.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/controllers/v1/lessons.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/course-lesson.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/course.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/course.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/education.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/enrollment.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/instructor.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/domain/lesson-progress.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/create-course-lesson.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/create-course.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/create-enrollment.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/create-instructor.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/create-lesson-progress.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/query-course-lesson.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/query-course.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/query-enrollment.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/query-instructor.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/query-lesson-progress.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/dto/update-instructor.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/education.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/events/education.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/jobs/completion-certificates.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'completion-certificates' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/jobs/instructor-royalties.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'instructor-royalties' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/policies/education.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/repositories/course-lesson.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/repositories/course.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/repositories/enrollment.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/repositories/instructor.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/repositories/lesson-progress.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/services/course-lesson.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/services/course.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/services/enrollment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/services/instructor.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/education/services/lesson-progress.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: instructors, courses, course_lessons, enrollments, lesson_progress.
- **DB tables:** instructors, courses, course_lessons, enrollments, lesson_progress
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `identity`  ·  PRD M01  ·  Priority Wave 1 · L
**Owns tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents, data_subject_requests, risk_scores, risk_events, user_blocks, user_phone_changes
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/identity/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/__tests__/identity.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/__tests__/user.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/addresses.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/auth.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/bank-accounts.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/consents.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/kyc.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/roles.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/controllers/v1/users.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/address.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/bank-account.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/consent.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/data-subject-request.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/device.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/identity.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/kyc-document.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/kyc-document.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/permission.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/risk-score.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/role.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/session.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/user-tenant-role.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/domain/user.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/create-address.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/create-kyc-document.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/create-permission.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/create-role.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/create-user-tenant-role.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/create-user.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/query-address.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/query-kyc-document.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/query-permission.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/query-role.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/query-user-tenant-role.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/query-user.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/dto/update-user.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/events/handlers/dispute-resolved.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'dispute.resolved' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/events/identity.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/identity.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/jobs/dpdp-erasure-cooling.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'dpdp-erasure-cooling' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/jobs/kyc-expiry-reminders.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'kyc-expiry-reminders' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/jobs/risk-score-recompute.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'risk-score-recompute' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/policies/identity.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/address.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/bank-account.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/consent.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/data-subject-request.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/device.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/kyc-document.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/permission.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/risk-score.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/role.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/session.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/user-tenant-role.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/repositories/user.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/services/kyc-document.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/services/permission.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/services/role.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/services/user-tenant-role.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/identity/services/user.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events.
- **DB tables:** users, roles, permissions, role_permissions, user_tenant_roles, staff_permission_overrides, kyc_documents, addresses, bank_accounts, devices, sessions, login_events, consent_purposes, consents
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L


---
## Module: `labour`  ·  PRD M28  ·  Priority Wave 1 · XL
**Owns tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements, mgnrega_job_cards, safety_checklists, labour_grievances
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/labour/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/__tests__/labour.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/__tests__/worker-profile.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/advances.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/assignments.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/attendance.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/bookings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/crews.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/grievances.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/sardars.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/controllers/v1/workers.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/attendance-record.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/booking-assignment.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/booking-assignment.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/crew.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/grievance.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/grievance.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/labour-booking.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/labour-booking.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/labour.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/mgnrega-job-card.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/migrant-engagement.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/minimum-wage.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/safety-checklist.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/sardar-profile.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/skill.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/worker-advance.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/worker-advance.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/worker-availability.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/worker-insurance.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/domain/worker-profile.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/create-booking-assignment.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/create-labour-booking.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/create-minimum-wage.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/create-skill.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/create-worker-availability.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/create-worker-profile.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/query-booking-assignment.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/query-labour-booking.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/query-minimum-wage.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/query-skill.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/query-worker-availability.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/query-worker-profile.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/dto/update-worker-profile.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/events/handlers/payout-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payout.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/events/labour.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/jobs/advance-cycle-audit.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'advance-cycle-audit' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/jobs/booking-respond-timeout.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'booking-respond-timeout' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/jobs/minwage-sync.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'minwage-sync' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/jobs/same-day-wage-sla.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'same-day-wage-sla' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/labour.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/policies/labour.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/read-models/worker-search.read-model.ts` 
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/attendance-record.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/booking-assignment.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/crew.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/grievance.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/labour-booking.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/mgnrega-job-card.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/migrant-engagement.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/minimum-wage.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/safety-checklist.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/sardar-profile.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/skill.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/worker-advance.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/worker-availability.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/worker-insurance.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/repositories/worker-profile.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/services/labour-booking.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/services/minimum-wage.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/services/skill.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/services/worker-availability.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/labour/services/worker-profile.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances.
- **DB tables:** skills, worker_profiles, worker_skills, worker_availability, minimum_wages, sardar_profiles, crews, crew_members, labour_bookings, booking_assignments, attendance_records, worker_advances, worker_insurance_enrolments, migrant_engagements
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL


---
## Module: `land-soil-weather`  ·  PRD M24  ·  Priority Wave 1 · M
**Owns tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/land-soil-weather/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/__tests__/land-parcel.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/__tests__/land-soil-weather.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/controllers/v1/crop-seasons.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/controllers/v1/parcels.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/controllers/v1/soil-tests.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/domain/crop-season.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/domain/land-parcel.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/domain/land-soil-weather.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/domain/soil-test.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/domain/weather-alert.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/create-crop-season.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/create-land-parcel.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/create-soil-test.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/create-weather-alert.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/query-crop-season.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/query-land-parcel.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/query-soil-test.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/query-weather-alert.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/dto/update-land-parcel.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/events/land-soil-weather.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/jobs/advisory-push.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'advisory-push' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/jobs/bhulekh-verify.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'bhulekh-verify' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/jobs/weather-ingest.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'weather-ingest' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/land-soil-weather.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/policies/land-soil-weather.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/repositories/crop-season.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/repositories/land-parcel.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/repositories/soil-test.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/repositories/weather-alert.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/services/crop-season.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/services/land-parcel.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/services/soil-test.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/land-soil-weather/services/weather-alert.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: land_parcels, crop_seasons, soil_tests, weather_alerts.
- **DB tables:** land_parcels, crop_seasons, soil_tests, weather_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `listings`  ·  PRD M03  ·  Priority Wave 1 · DONE
**Owns tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/listings/README.md` ✅ DONE — reference/seeded
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/__tests__/listing.entity.spec.ts` ✅ DONE — reference/seeded
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/__tests__/listing.service.spec.ts` ✅ DONE — reference/seeded
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/__tests__/listing.state.spec.ts` ✅ DONE — reference/seeded
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/__tests__/listings.e2e-spec.ts` ✅ DONE — reference/seeded
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/__tests__/tenant-isolation.spec.ts` ✅ DONE — reference/seeded
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/controllers/v1/boosts.controller.ts` ✅ DONE — reference/seeded
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/controllers/v1/group-lots.controller.ts` ✅ DONE — reference/seeded
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/controllers/v1/listings.controller.ts` ✅ DONE — reference/seeded
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/group-lot-pledge.entity.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/group-lot.entity.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/group-lot.state.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/listing-attribute.entity.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/listing-boost.entity.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/listing.entity.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/listing.state.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/listings.events.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/domain/price-history.entity.ts` ✅ DONE — reference/seeded
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/create-group-lot-pledge.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/create-group-lot.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/create-listing-attribute.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/create-listing-boost.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/create-listing.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/create-price-history.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/query-group-lot-pledge.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/query-group-lot.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/query-listing-attribute.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/query-listing-boost.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/query-listing.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/query-price-history.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/dto/update-listing.dto.ts` ✅ DONE — reference/seeded
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/events/handlers/auction-settled.handler.ts` ✅ DONE — reference/seeded
- **Layer:** Event Handler
- **Implement:** React to the 'auction.settled' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/events/handlers/order-completed.handler.ts` ✅ DONE — reference/seeded
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/events/listings.publisher.ts` ✅ DONE — reference/seeded
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/jobs/boost-expiry.job.ts` ✅ DONE — reference/seeded
- **Layer:** Background Job
- **Implement:** Queue/cron job 'boost-expiry' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/jobs/expire-listings.job.ts` ✅ DONE — reference/seeded
- **Layer:** Background Job
- **Implement:** Queue/cron job 'expire-listings' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/jobs/publish-scheduled.job.ts` ✅ DONE — reference/seeded
- **Layer:** Background Job
- **Implement:** Queue/cron job 'publish-scheduled' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/listings.module.ts` ✅ DONE — reference/seeded
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/policies/listings.policies.ts` ✅ DONE — reference/seeded
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/read-models/listing-search.read-model.ts` ✅ DONE — reference/seeded
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/read-models/mandi-band.read-model.ts` ✅ DONE — reference/seeded
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/repositories/group-lot-pledge.repository.ts` ✅ DONE — reference/seeded
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/repositories/group-lot.repository.ts` ✅ DONE — reference/seeded
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/repositories/listing-attribute.repository.ts` ✅ DONE — reference/seeded
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/repositories/listing-boost.repository.ts` ✅ DONE — reference/seeded
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/repositories/listing.repository.ts` ✅ DONE — reference/seeded
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/repositories/price-history.repository.ts` ✅ DONE — reference/seeded
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/services/group-lot-pledge.service.ts` ✅ DONE — reference/seeded
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/services/group-lot.service.ts` ✅ DONE — reference/seeded
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/services/listing-attribute.service.ts` ✅ DONE — reference/seeded
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/services/listing-boost.service.ts` ✅ DONE — reference/seeded
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · DONE

### `apps/api/src/modules/listings/services/listing.service.ts` ✅ DONE — reference/seeded
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches.
- **DB tables:** listings, listing_attribute_values, listing_price_history, group_lots, group_lot_pledges, listing_boosts, listing_offers, saved_items, saved_searches
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · DONE


---
## Module: `logistics`  ·  PRD M07  ·  Priority Wave 1 · M
**Owns tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/logistics/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/__tests__/logistics.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/__tests__/shipment.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/controllers/v1/partners.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/controllers/v1/routes.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/controllers/v1/shipments.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/controllers/v1/zones.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/cold-chain-log.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/delivery-route.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/delivery-zone.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/logistics-partner.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/logistics.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/pickup-slot.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/shipment.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/shipment.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/domain/vehicle.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/create-delivery-route.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/create-delivery-zone.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/create-logistics-partner.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/create-pickup-slot.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/create-shipment.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/create-vehicle.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/query-delivery-route.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/query-delivery-zone.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/query-logistics-partner.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/query-pickup-slot.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/query-shipment.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/query-vehicle.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/dto/update-shipment.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/events/handlers/order-confirmed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.confirmed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/events/logistics.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/jobs/cold-chain-breach-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'cold-chain-breach-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/jobs/village-run-consolidation.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'village-run-consolidation' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/logistics.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/policies/logistics.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/cold-chain-log.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/delivery-route.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/delivery-zone.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/logistics-partner.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/pickup-slot.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/shipment.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/repositories/vehicle.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/services/delivery-zone.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/services/logistics-partner.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/services/pickup-slot.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/services/shipment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/logistics/services/vehicle.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs.
- **DB tables:** delivery_zones, logistics_partners, vehicles, pickup_slots, shipments, shipment_events, delivery_routes, cold_chain_logs
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `market-intel`  ·  PRD §16.2  ·  Priority Wave 1 · M
**Owns tables:** mandis, mandi_prices, price_predictions, price_alerts
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/market-intel/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/__tests__/mandi.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/__tests__/market-intel.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/controllers/v1/mandi-prices.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/controllers/v1/predictions.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/controllers/v1/price-alerts.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/domain/mandi-price.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/domain/mandi.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/domain/market-intel.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/domain/price-alert.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/domain/price-prediction.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/domain/search-synonym.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/create-mandi-price.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/create-mandi.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/create-price-alert.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/create-price-prediction.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/create-search-synonym.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/query-mandi-price.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/query-mandi.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/query-price-alert.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/query-price-prediction.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/query-search-synonym.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/dto/update-mandi.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/events/market-intel.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/jobs/agmarknet-ingest.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'agmarknet-ingest' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/jobs/enam-ingest.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'enam-ingest' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/jobs/price-alert-fanout.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'price-alert-fanout' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/jobs/synonym-publish.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'synonym-publish' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/market-intel.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/policies/market-intel.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/read-models/mandi-pulse.read-model.ts` 
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/repositories/mandi-price.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/repositories/mandi.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/repositories/price-alert.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/repositories/price-prediction.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/repositories/search-synonym.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/services/mandi-price.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/services/mandi.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/services/price-alert.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/services/price-prediction.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/market-intel/services/search-synonym.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: mandis, mandi_prices, price_predictions, price_alerts.
- **DB tables:** mandis, mandi_prices, price_predictions, price_alerts
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `offers`  ·  PRD M04  ·  Priority Wave 1 · S
**Owns tables:** listing_offers
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/offers/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/__tests__/listing-offer.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/__tests__/offers.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/controllers/v1/offers.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/domain/listing-offer.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: listing_offers.
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/domain/listing-offer.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: listing_offers.
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/domain/offers.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: listing_offers.
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/dto/create-listing-offer.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/dto/query-listing-offer.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/dto/update-listing-offer.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/events/offers.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/jobs/expire-offers.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'expire-offers' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/offers.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/policies/offers.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/repositories/listing-offer.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: listing_offers.
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · S

### `apps/api/src/modules/offers/services/listing-offer.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: listing_offers.
- **DB tables:** listing_offers
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · S


---
## Module: `orders`  ·  PRD M06  ·  Priority Wave 1 · XL
**Owns tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/orders/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/__tests__/order.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/__tests__/orders.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/controllers/v1/carts.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law7 i18n keys, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/controllers/v1/checkout.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law7 i18n keys, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/controllers/v1/orders.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law7 i18n keys, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/cart-item.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/cart.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/checkout-group.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/order-item.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/order.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/order.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/domain/orders.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/create-cart-item.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/create-cart.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/create-checkout-group.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/create-order-item.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/create-order.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/query-cart-item.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/query-cart.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/query-checkout-group.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/query-order-item.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/query-order.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/dto/update-order.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/events/handlers/dispute-resolved.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'dispute.resolved' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/events/handlers/shipment-delivered.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'shipment.delivered' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/events/orders.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/jobs/abandoned-carts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'abandoned-carts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/jobs/auto-complete-quality-window.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'auto-complete-quality-window' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/jobs/seller-confirm-timeout.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'seller-confirm-timeout' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/orders.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/policies/orders.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/read-models/order-timeline.read-model.ts` 
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/read-models/tenant-order-stats.read-model.ts` 
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/repositories/cart-item.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/repositories/cart.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/repositories/checkout-group.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/repositories/order-item.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/repositories/order.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law8 partition pruning, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/services/cart-item.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/services/cart.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/services/checkout-group.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/services/order-item.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/orders/services/order.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: carts, cart_items, checkout_groups, orders, order_items, order_events.
- **DB tables:** carts, cart_items, checkout_groups, orders, order_items, order_events
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL


---
## Module: `payments`  ·  PRD M05  ·  Priority Wave 1 · XL
**Owns tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/payments/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/__tests__/payment.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/__tests__/payments.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/controllers/v1/commission-rules.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law6 dynamic data not code, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/controllers/v1/invoices.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/controllers/v1/payments.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/controllers/v1/payouts.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/charge-definition.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/commission-rule.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/payment.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/payment.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/payments.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/payout-batch.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/payout.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/payout.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/settlement-statement.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/tax-rule.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/domain/trade-invoice.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/create-commission-rule.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/create-payment.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/create-payout-batch.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/create-payout.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/create-settlement-statement.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/create-trade-invoice.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/query-commission-rule.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law6 dynamic data not code, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/query-payment.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/query-payout-batch.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/query-payout.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/query-settlement-statement.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/query-trade-invoice.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/dto/update-payment.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/events/handlers/booking-clocked-out.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'booking.clocked.out' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/events/handlers/razorpay-webhook.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'razorpay.webhook' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/events/payments.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/jobs/daily-gateway-recon.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'daily-gateway-recon' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/jobs/payout-queue-monitor.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'payout-queue-monitor' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/jobs/settlement-statements.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'settlement-statements' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/jobs/wage-priority-lane.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'wage-priority-lane' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/payments.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/policies/payments.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/read-models/wallet-balance.read-model.ts` 
- **Layer:** Read-Model (CQRS read path)
- **Implement:** Serve list/search/dashboard reads from OpenSearch or a replica projection — NEVER the write primary (scale, Law12). Kept in sync by the search/projection consumer reading this module's outbox events. Always filter by tenant_id in the query itself. 
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/charge-definition.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/commission-rule.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/payment.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/payout-batch.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/payout.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/settlement-statement.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law5 sole state machine, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/tax-rule.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law6 dynamic data not code, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/repositories/trade-invoice.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/services/payment.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/services/payout-batch.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/services/payout.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/services/settlement-statement.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · XL

### `apps/api/src/modules/payments/services/trade-invoice.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices.
- **DB tables:** commission_rules, tax_rules, charge_definitions, wallet_accounts, ledger_transactions, ledger_entries, reconciliation_runs, payments, payouts, payout_batches, settlement_statements, trade_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · XL


---
## Module: `requirements`  ·  PRD M12  ·  Priority Wave 1 · M
**Owns tables:** requirements, requirement_responses
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/requirements/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/__tests__/requirement.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/__tests__/requirements.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/controllers/v1/requirements.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/controllers/v1/responses.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/domain/requirement-response.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/domain/requirement.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/domain/requirement.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/domain/requirements.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/dto/create-requirement-response.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/dto/create-requirement.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/dto/query-requirement-response.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/dto/query-requirement.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/dto/update-requirement.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/events/handlers/listing-published.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'listing.published' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/events/requirements.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/jobs/expire-requirements.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'expire-requirements' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/jobs/match-notifications.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'match-notifications' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/policies/requirements.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/repositories/requirement-response.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/repositories/requirement.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/requirements.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/services/requirement-response.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/requirements/services/requirement.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: requirements, requirement_responses.
- **DB tables:** requirements, requirement_responses
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `reviews`  ·  PRD M08  ·  Priority Wave 1 · S
**Owns tables:** reviews
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/reviews/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/__tests__/review.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/__tests__/reviews.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/controllers/v1/reviews.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/domain/review.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: reviews.
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/domain/reviews.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: reviews.
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/dto/create-review.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/dto/query-review.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/dto/update-review.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/events/handlers/booking-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'booking.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/events/handlers/order-completed.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'order.completed' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/events/reviews.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/jobs/review-prompts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'review-prompts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/policies/reviews.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/repositories/review.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: reviews.
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/reviews.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · S

### `apps/api/src/modules/reviews/services/review.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: reviews.
- **DB tables:** reviews
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · S


---
## Module: `support`  ·  PRD §50  ·  Priority Wave 1 · M
**Owns tables:** support_tickets
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/support/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/__tests__/support-ticket.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/__tests__/support.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/controllers/v1/tickets.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/domain/support-ticket.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: support_tickets.
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/domain/support-ticket.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: support_tickets.
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/domain/support.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: support_tickets.
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/dto/create-support-ticket.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/dto/query-support-ticket.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/dto/update-support-ticket.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/events/handlers/dispute-escalated.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'dispute.escalated' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/events/support.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/jobs/csat-survey.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'csat-survey' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/jobs/sla-breach-escalation.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'sla-breach-escalation' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/policies/support.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/repositories/support-ticket.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: support_tickets.
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/services/support-ticket.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: support_tickets.
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · M

### `apps/api/src/modules/support/support.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** support_tickets
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · M


---
## Module: `tenancy`  ·  PRD M01-billing  ·  Priority Wave 1 · L
**Owns tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices, feature_flags, api_keys, webhook_endpoints, webhook_deliveries, integration_providers, tenant_integrations, usage_counters
_(copy the `listings` module pattern — see apps/api/src/modules/listings/README.md)_

### `apps/api/src/modules/tenancy/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/__tests__/tenancy.e2e-spec.ts` 
- **Layer:** Test · E2E
- **Implement:** Integration test per endpoint against a real DB: happy path, authz denial, idempotency replay, quota limit, validation errors. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/__tests__/tenant-isolation.spec.ts` 
- **Layer:** Test · Tenant Isolation (CI GATE)
- **Implement:** MANDATORY. Assert tenant A cannot read/update tenant B's rows even with a forged id (RLS + app scope + read-model filter). This test blocks merge. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/__tests__/tenant.service.spec.ts` 
- **Layer:** Test · Unit/Integration
- **Implement:** Cover domain logic / service orchestration: invariants, state transitions (legal+illegal), money math exactness, edge cases. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/controllers/v1/plans.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/controllers/v1/subscriptions.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/controllers/v1/tenant-settings.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/controllers/v1/tenants.controller.ts` 
- **Layer:** HTTP Controller v1
- **Implement:** Thin: validate (zod DTO) → authorize (@RequirePermission + guards) → delegate to service → return standard envelope. Wire AuthGuard, PermissionsGuard, QuotaGuard, Idempotency-Key, rate-limit. No business logic. OpenAPI annotations. Feature-flag the route (Law10). i18n error keys (Law7). 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/plan.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/saas-invoice.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/subscription.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/subscription.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/tenancy.events.ts` 
- **Layer:** Domain · Events
- **Implement:** Declare every domain event this module publishes (names + typed payloads). Mirror these in packages/contracts/src/events. Payloads carry IDs + minor-unit strings, never PII. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/tenant-domain.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/tenant-feature.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/tenant-settings.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/tenant.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/tenant.state.ts` 
- **Layer:** Domain · State Machine
- **Implement:** Define the FULL set of allowed status transitions for this entity as a const map, plus assertTransition()/canTransition(). This is the ONLY file that decides status changes (Law5). Pure TS, no imports. Cover every status in the matching DB enum. 100% branch test coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law5 sole state machine, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/domain/usage-counter.entity.ts` 
- **Layer:** Domain · Entity
- **Implement:** Pure domain class with invariants & behaviour (no framework, no SQL). Money fields are bigint minor units (Law2). Encapsulate business rules (validation, derived values, guarded mutations that call the state machine). 95% unit coverage. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/create-plan.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/create-saas-invoice.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/create-subscription.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/create-tenant-domain.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/create-tenant-settings.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/create-tenant.dto.ts` 
- **Layer:** DTO (create)
- **Implement:** zod schema for create payload; money as string→bigint; reuse shared shapes from packages/contracts. Validate ranges, enums, required fields per the DB constraints. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/query-plan.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/query-saas-invoice.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/query-subscription.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/query-tenant-domain.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/query-tenant-settings.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/query-tenant.dto.ts` 
- **Layer:** DTO (query)
- **Implement:** zod schema for list/filter/sort with cursor pagination (limit≤100). Whitelist sortable/filterable fields. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/dto/update-tenant.dto.ts` 
- **Layer:** DTO (update)
- **Implement:** zod schema for partial update; never allow tenant_id/owner override; version for optimistic lock. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/events/handlers/payment-succeeded.handler.ts` 
- **Layer:** Event Handler
- **Implement:** React to the 'payment.succeeded' event idempotently (dedupe by event id). Keep handler fast; heavy work → enqueue a job. May update this module's own tables only. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/events/tenancy.publisher.ts` 
- **Layer:** Event Publisher
- **Implement:** Thin helper documenting this module's outbox publishing; actual writes happen inside service transactions via OutboxWriter. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law4 outbox in same txn, Law8 partition pruning, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/jobs/grace-period.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'grace-period' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/jobs/renewal-invoices.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'renewal-invoices' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/jobs/trial-expiry.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'trial-expiry' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/jobs/usage-limit-alerts.job.ts` 
- **Layer:** Background Job
- **Implement:** Queue/cron job 'usage-limit-alerts' executed in apps/worker. Idempotent, batched, resumable, tenant-aware, respects backpressure. Reads/writes only this module's tables; emits events for cross-module effects. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/policies/tenancy.policies.ts` 
- **Layer:** Policies
- **Implement:** Export the permission codes this module checks (must exist in db/seeds/core/0004 permissions + role grants). Used by @RequirePermission and staff overrides. 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/plan.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/saas-invoice.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/subscription.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/tenant-domain.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/tenant-feature.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/tenant-settings.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/tenant.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/repositories/usage-counter.repository.ts` 
- **Layer:** Repository
- **Implement:** ALL SQL for this entity. Every query tenant-scoped (Law1) and shard-routed via core/sharding; reads via read-replica provider, writes via primary on the tenant shard; optimistic locking with version; partition-pruning helper for partitioned tables (Law8). No other module imports this. Parameterised queries only (no string concat). DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law9 migrations as PRs, Law10 feature flag, Law12 degrade-not-die / scale
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/services/plan.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/services/saas-invoice.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/services/subscription.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/services/tenant-domain.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/services/tenant.service.ts` 
- **Layer:** Application Service (use-case)
- **Implement:** Orchestrate a use-case: load via repository, apply domain logic, persist + write outbox event in ONE transaction (Law4), enforce idempotency (Law3) and plan quota where relevant, call wallet-service gRPC for any money (Law2 — never touch ledger tables). Emit audit_log for sensitive actions. DB tables in scope: plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions.
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 1 · L

### `apps/api/src/modules/tenancy/tenancy.module.ts` 
- **Layer:** Module Wiring
- **Implement:** NestJS @Module: register controllers/providers; export ONLY the public service (other modules use the service/events, never the repository). 
- **DB tables:** plans, features, plan_features, plan_limits, tenants, tenant_domains, setting_definitions, tenant_settings, tenant_features, tenant_service_areas, tenant_status_events, subscriptions, subscription_addons, saas_invoices
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** Wave 1 · L
