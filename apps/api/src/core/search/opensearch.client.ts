// core/search/opensearch.client.ts · the OpenSearch-backed SearchClient (Phase-2 read path). Translates the
// SearchQuery abstraction into an OpenSearch query DSL and runs it through the resilience-wrapped transport.
// SECURITY (the part attackers test first): OpenSearch has NO row-level security, so this client ALWAYS injects
// a non-negotiable `tenant_id` term filter built from q.tenantId — a query for one tenant can never return
// another tenant's documents (the tenant-isolation invariant for the search path; unit-asserted). Pagination is
// keyset via `search_after` over the deterministic sort (never `from`/OFFSET — that scans+skips at scale, Law 5).
import { Inject, Injectable } from '@nestjs/common';
import { SearchClient, SearchQuery, SearchPage } from './search.client';
import { OpenSearchTransport } from './opensearch.transport';

const MAX_LIMIT = 100;
// Platform/global reference docs (e.g. master products, tenant_id NULL in the DB) are indexed under this
// sentinel and are readable by every tenant (Law 11: platform reference data is read-only-visible in tenant
// scope). A caller only ever sees their own tenant's docs + platform docs — never another tenant's.
export const PLATFORM_TENANT = '__platform__';
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const unb64 = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

@Injectable()
export class OpenSearchSearchClient extends SearchClient {
  constructor(@Inject(OpenSearchTransport) private readonly transport: OpenSearchTransport) { super(); }

  async query<T = any>(index: string, q: SearchQuery): Promise<SearchPage<T>> {
    if (!q.tenantId) throw new Error('SEARCH_TENANT_REQUIRED');     // fail closed — never an untenanted query
    const size = Math.min(Math.max(q.limit, 1), MAX_LIMIT);

    // Mandatory tenant filter + caller filters; free text (if any) is a should-match over the named text fields.
    const filter: Record<string, unknown>[] = [{ terms: { tenant_id: [q.tenantId, PLATFORM_TENANT] } }, ...(q.filter ?? [])];
    const must: Record<string, unknown>[] = [];
    if (q.text && q.text.trim()) {
      must.push({ multi_match: { query: q.text.trim(), fields: q.textFields ?? ['*'], type: 'best_fields', operator: 'and' } });
    }
    const bool: Record<string, unknown> = { filter };
    if (must.length) bool.must = must;
    if (q.should && q.should.length) { bool.should = q.should; bool.minimum_should_match = 0; }

    // Deterministic sort: the caller's field, then _id as the keyset tiebreaker (so search_after is stable).
    const sort: unknown[] = [...this.parseSort(q.sort), { _id: 'asc' }];
    const body: Record<string, unknown> = { size, query: { bool }, sort, track_total_hits: false };
    if (q.cursor) { try { body.search_after = unb64(q.cursor); } catch { /* malformed → first page */ } }

    const res = await this.transport.search<any>(index, body);
    const hits: any[] = res?.hits?.hits ?? [];
    const items = hits.map((h) => ({ id: h._id, ...(h._source ?? {}) })) as T[];
    const last = hits[hits.length - 1];
    const nextCursor = hits.length === size && last?.sort ? b64(last.sort) : undefined;
    return { items, nextCursor };
  }

  /** "field" | "field:desc" | "a:asc,b:desc" → OpenSearch sort clauses. */
  private parseSort(sort: string): unknown[] {
    if (!sort) return [];
    return sort.split(',').map((part) => {
      const [field, dir] = part.split(':');
      return { [field.trim()]: dir?.trim() === 'desc' ? 'desc' : 'asc' };
    });
  }
}
