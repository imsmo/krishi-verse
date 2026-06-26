# Governed farmer AI assistant (`assistant`) — P1-13

A farmer asks a question; the platform returns a **governed, logged** answer in their language (hi/en/gu) — or a
**safe non-fabricated** message when it can't. The model runs ONLY in the internal `ai-services` tier (Law 11);
the api tier orchestrates guardrails, cost/rate caps, and audit.

## Route
- `POST /v1/ai/assistant/messages` — authenticated (any tenant user; farmer-facing, no special perm), behind the
  `ai_assistant` flag, **idempotent** (`Idempotency-Key` required, Law 3). Body (zod `.strict()`):
  `{ message, languageCode: hi|en|gu, sessionId? }`. Returns `{ reply, sessionId, status, citations }` where
  `status ∈ answered | needs_review | blocked`.

## Pipeline (every step fails closed)
1. **Screen** (`domain/guardrails.ts`) — sanitize (strip control chars, collapse ws, cap 2000) + heuristic
   prompt-injection scan (override / reveal-prompt / jailbreak / dev-mode / secret-exfil / role-escape, ReDoS-safe).
   A hit ⇒ **blocked**: no model call, a safe refusal, a logged `blocked` inference.
2. **Cost / rate caps** (`domain/cost-cap.ts`) — per-user burst (per-minute) + budget (per-day) windows, COUNTED
   off `ai_inferences` on the replica. Over a cap ⇒ typed **429** (`ASSISTANT_RATE_LIMITED`, which window).
3. **Governed inference** — `ASSISTANT_INFERENCE` port → s2s HTTP adapter to `ai-services /v1/assistant`
   (shared-secret bearer), **resilience-wrapped** (timeout+retry+breaker+bulkhead). No provider / breaker open /
   error ⇒ **degrade**: `needs_review` with a safe message — **never a fabricated answer** (Law 12).
4. **Record** — one tx: insert `ai_inferences` (subject `assistant_message`, **pointers only** — userId/lang/flags,
   never the message text) + append-only `audit_log`. Metric on every turn.

## Config (fail-closed; degrade without a key)
`AI_SERVICES_URL` + `AI_SERVICES_SHARED_SECRET` (else the noop/degrade adapter binds → always `needs_review`),
`AI_SERVICES_TIMEOUT_MS`, `AI_ASSISTANT_DAILY_CAP`, `AI_ASSISTANT_PER_MINUTE_CAP`. The model provider key lives on
`ai-services` (`ANTHROPIC_API_KEY`) — without it, `ai-services` itself degrades to `needs_review`.

## No new migration
Logs to the existing `ai_inferences` (db/migrations 0013); RLS already applies (tenant_id). The `ai_assistant`
flag is seeded OFF (`db/seeds/core/0009_feature_flags.sql`).

## ai-services side (`apps/ai-services/src/assistant`)
`router.py` (s2s-authed `POST /v1/assistant`) + a second-layer `guardrails.py` + a model PORT `provider.py`
(`AnthropicProvider` real, under the `llm` breaker + timeout; `DegradedProvider` when no key). Records its own
`ai_inferences` row (pointers only). Advisory only.

## Scope / deferred
This build is single-turn ask + governed log. **Deferred:** retrieval-augmented citations (grounding on
catalogue/scheme docs), multi-turn memory beyond `sessionId` threading, and streaming responses.
