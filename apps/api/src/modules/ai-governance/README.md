# ai-governance (PRD §8.3) — the control plane for every AI decision

Every consequential AI decision on the platform is registered, logged, and — when the model isn't confident
enough — routed to a human. Plus a content-moderation report queue. Money-free. Gated by the `ai_governance`
feature flag (default **OFF**).

## What it owns

- **Model registry** (`ai_models`, **GLOBAL** — no tenant_id) — every model version with its lifecycle
  (`shadow → canary → production → retired`, the sole state machine in `ai-model.state.ts`) and its
  `confidence_threshold` (below which an inference goes to human review). **Read-only here**: browse the live
  registry + resolve the model serving a code. Authoring/promotion is a **platform / admin-api** concern
  (Law 11) — not exposed on the tenant API (mirrors how `market-intel` treats `mandis`). The `AiModel` entity +
  state machine are the shared contract admin-api drives, fully unit-tested.
- **Inference audit log** (`ai_inferences`, tenant-scoped, **append-only**, PARTITIONED by `created_at`) — the
  explainability spine: which model decided what about which subject, with what confidence. `input_ref` holds
  **pointers only, never raw PII** (rejected at the domain edge). A human override is stamped on the row.
- **Human-in-the-loop review queue** (`ai_review_queue`, tenant-scoped) — a review item per low-confidence /
  flagged inference. Lifecycle `pending → in_review → accepted | rejected` (`ai-review.state.ts`). A reviewer
  **claims** (FOR UPDATE — no double-claim) then **resolves**; the decision drives the originating module via
  the outbox. A `rejected` decision marks the linked inference overridden.
- **Moderation reports** (`moderation_reports`, tenant-scoped) — any user reports content; `open → actioned |
  dismissed` (`moderation.state.ts`). A moderator handles it (hide/remove/warn/suspend).

## Surface (v1, under the `ai_governance` flag)

- Models (`ai.review`): `GET /v1/ai/models`, `GET /v1/ai/models/:id` — read-only registry.
- Inferences (`ai.review`): `POST /v1/ai/inferences` (record; Idempotency-Key), `GET` (by subject / tenant
  timeline), `GET /:id`, `POST /:id/override`.
- Review queue (`ai.review`): `GET /v1/ai/review-queue`, `POST` (manual enqueue), `GET /:id`,
  `POST /:id/claim`, `POST /:id/resolve`.
- Moderation (`content.moderate` to list/handle; **filing needs only authentication**):
  `POST /v1/ai/moderation/reports` (any user), `GET`, `GET /:id`, `POST /:id/handle`.

## Events emitted (outbox, in-tx — IDs only, never PII)

`ai.review_enqueued`, `ai.review_resolved`, `ai.moderation_filed` (first open report only),
`ai.moderation_actioned`, plus `ai.model_promoted` / `ai.model_retired` (admin-api contract). Recording an
inference deliberately emits **no** event (billions of ops — no write amplification); only enqueueing a review
notifies.

## Threats considered (§4)

- **Tenant isolation / RLS** — `ai_inferences` / `ai_review_queue` / `moderation_reports` are RLS-protected and
  bind `tenant_id` in every query (cross-tenant read denied — proven in the integration test). `ai_models` is
  global, no tenant data.
- **Least privilege (Law 6 + Law 11)** — recording/reviewing needs `ai.review`; moderation handling needs
  `content.moderate`; **model lifecycle is NOT writable on the tenant API** (platform/admin-api only — no
  privilege escalation). Authz throws.
- **No IDOR** — review/report/inference reads are tenant-scoped (404, never cross-tenant enumeration).
- **PII** — `input_ref` is pointers only; the domain rejects obvious PII keys; outputs/events carry IDs, no PII.
- **Abuse / DoS** — a reporter can file only ONE live report per subject (partial UNIQUE index, migration 0029,
  `ON CONFLICT DO NOTHING`) — a mass-reporter creates one row, not thousands; lists are bounded + keyset; the
  first-open-report check means duplicates don't re-notify.
- **Concurrency** — no version column → claim/resolve/handle lock the row `FOR UPDATE` (no double-claim).
- **Integrity / audit** — every reviewer + moderator action writes an `audit_log` row in the same tx.

## Scale

Inference reads bound `subject` / `tenant` and keyset on `(created_at, id)` so PG prunes the time partitions
(Law 8); the review queue claim order is indexed `(tenant_id, priority, created_at) WHERE pending`. The
`drift-watch` and `fairness-audit-monthly` jobs run on the BYPASSRLS relay pool, bounded per run.

## Deferred

Auto-recording of inferences from other modules' events (each module calls `AiInferenceService.record` directly
when wired — the service is exported); model lifecycle writes (admin-api, Law 11); drift/fairness jobs are
runnable functions (`runDriftWatch` / `runFairnessAudit`) pending worker registration.

## Tests

`__tests__/ai-governance-domain.spec.ts` (three state machines + inference/PII invariants),
`ai-inference.service.spec.ts` (record → threshold-gated enqueue, force, idempotent, 404, override),
`ai-review.service.spec.ts` (claim FOR UPDATE + transition, double-claim 409, resolve event + reject→override),
`moderation.service.spec.ts` (file dedup + first-open notify, handle gate + audit + event),
`tenant-isolation.spec.ts` (CI gate: tenant binding, FOR UPDATE, keyset, ON CONFLICT dedup),
`ai-governance.integration.spec.ts` (real Postgres + 0029: model → low-confidence inference → review → claim →
reject → override → moderation file + dedup → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
