-- ============================================================================
-- MIGRATION 0063 — CONVERSATIONS: UNIQUE (tenant_id, context_type, context_id) FOR 1:1 CONTEXTS
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it in schema_migrations.
-- NEVER edit an applied migration — add a new numbered one.
--
-- WHY (S3 review follow-up): ConversationService.open() reads-then-inserts (findByContext, then INSERT if
-- nothing found) with no DB constraint backing the "one thread per (tenant, contextType, contextId)"
-- invariant it relies on for order/requirement/dispute/booking/support_ticket threads — two concurrent
-- opens for the same context can both miss the read and each insert a conversation, silently splitting a
-- thread in two. This adds the constraint the code already assumes.
--
-- Scope: ONLY the genuinely 1:1 context types. 'direct' and 'listing' are MULTI-thread by design
-- (modules/communication/domain/messaging.events.ts MULTI_THREAD_CONTEXT_TYPES — a 'direct' DM pair may
-- reopen repeatedly, and a 'listing' legitimately has one thread PER BUYER) — they MUST be excluded or this
-- index would wrongly collapse many buyers' distinct listing-inquiry threads into one. Soft-deleted rows
-- (deleted_at, added by add_std_columns) are excluded so an archived/deleted thread never blocks reopening
-- a fresh one for the same context.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_context_1to1
  ON conversations(tenant_id, context_type, context_id)
  WHERE context_type NOT IN ('direct', 'listing') AND deleted_at IS NULL;
