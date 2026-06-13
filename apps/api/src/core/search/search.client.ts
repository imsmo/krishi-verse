// core/search/search.client.ts · thin OpenSearch abstraction for read-models.
export interface SearchQuery {
  filter: Record<string, unknown>[]; should?: Record<string, unknown>[];
  sort: string; cursor?: string; limit: number; text?: string;
}
export interface SearchPage<T> { items: T[]; nextCursor?: string; total?: number; }
export abstract class SearchClient {
  abstract query<T = any>(index: string, q: SearchQuery): Promise<SearchPage<T>>;
}
export const SEARCH_CLIENT = Symbol('SEARCH_CLIENT');
