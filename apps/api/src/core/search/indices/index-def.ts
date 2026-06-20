// core/search/indices/index-def.ts · the contract every searchable index declares. An IndexDef is the single
// source of truth for: the OpenSearch mapping/settings, where to read source rows for a backfill (table +
// keyset columns), how to project a DB row → a search document (tenant_id ALWAYS present), whether a given row
// belongs in the index, and which outbox event types trigger a re-sync.
//
// SYNC MODEL (robust, not brittle): an event means "aggregate X changed". The handler RE-READS the current row
// by id and decides: row present AND isIndexable → upsert the projected doc; otherwise → delete the doc. So a
// single `status_changed` event correctly indexes a now-published listing OR drops a now-archived one — the
// event type list only decides WHICH events wake the sync, never the up/down decision.
export interface IndexSource {
  table: string;            // source table on the read replica / relay pool (backfill + re-read)
  idCol: string;            // primary key column (the doc _id, == event aggregateId)
  timeCol: string;          // keyset/ordering column for the backfill (created_at)
  /** WHERE predicate (no params) selecting the rows that belong in the index — the SQL form of isIndexable. */
  indexableWhere: string;
}
export interface IndexDef {
  logical: string;                                   // unprefixed name (kv_<logical> at runtime)
  textFields: string[];                              // default free-text match fields
  body: Record<string, unknown>;                     // OpenSearch create-index body (settings + mappings)
  source: IndexSource;
  /** Row → search document. MUST set tenant_id (use PLATFORM_TENANT for platform/global rows). Pure. */
  project: (row: Record<string, any>) => { id: string; doc: Record<string, unknown> };
  /** Does this (present) row belong in the index? In-memory mirror of source.indexableWhere. Pure. */
  isIndexable: (row: Record<string, any>) => boolean;
  /** Outbox eventTypes that trigger a re-sync of the aggregate. */
  eventTypes: string[];
}

// Shared analysis: lowercase + asciifolding so "Tomatō" matches "tomato" across hi/en/gu inputs.
export const KV_ANALYSIS = {
  analyzer: { kv_text: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding'] } },
};
