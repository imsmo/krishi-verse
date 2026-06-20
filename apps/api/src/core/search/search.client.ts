// core/search/search.client.ts · thin OpenSearch abstraction for read-models.
// tenantId is MANDATORY (OpenSearch has no RLS — the client injects a non-negotiable tenant_id filter on every
// query so one tenant can never see another's documents; see opensearch.client.ts).
export interface SearchQuery {
  tenantId: string;
  filter: Record<string, unknown>[]; should?: Record<string, unknown>[];
  sort: string; cursor?: string; limit: number; text?: string;
  textFields?: string[];      // which fields the free-text `text` matches (defaults per index)
}
export interface SearchPage<T> { items: T[]; nextCursor?: string; total?: number; }
export abstract class SearchClient {
  abstract query<T = any>(index: string, q: SearchQuery): Promise<SearchPage<T>>;
}
export const SEARCH_CLIENT = Symbol('SEARCH_CLIENT');
