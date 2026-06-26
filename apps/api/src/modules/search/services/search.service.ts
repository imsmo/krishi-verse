// modules/search/services/search.service.ts · the unified cross-entity search use-case (CQRS read; Law 12).
// Fans the free-text query across the requested entity indices on OpenSearch (tenant-isolated by the search
// client's mandatory tenant filter), merges + ranks them into ONE list, and federates the cursor per type. If
// the engine is unconfigured or unavailable (NullSearchClient throws, or the transport trips its breaker), it
// DEGRADES to the Postgres fallback read-model — same shape, same tenant isolation — and tags the response
// `engine: 'postgres'` so callers/telemetry can see the degrade. A metric + timing on every call.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SEARCH_CLIENT, SearchClient } from '../../../core/search/search.client';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { SearchFallbackReadModel } from '../read-models/search-fallback.read-model';
import { QuerySearchDto } from '../dto/search.dto';
import { SearchType, RawHit, RankedHit, parseTypes, clampLimit, rankHits, encodeSearchCursor, decodeSearchCursor } from '../domain/search.rank';

// per-type index logical name + the engine's text field + how to read a hit's title.
const INDEX: Record<SearchType, { logical: string; textFields: string[]; title: (s: Record<string, any>) => string }> = {
  listings: { logical: 'listings', textFields: ['title'], title: (s) => s.title ?? '' },
  products: { logical: 'products', textFields: ['name'], title: (s) => s.name ?? '' },
};

export interface UnifiedSearchResult { items: RankedHit[]; engine: 'opensearch' | 'postgres'; nextCursor: string | null; }

@Injectable()
export class SearchService {
  private readonly log = new Logger('Search');
  constructor(
    @Inject(SEARCH_CLIENT) private readonly engine: SearchClient,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly fallback: SearchFallbackReadModel,
  ) {}

  async search(tenantId: string, dto: QuerySearchDto): Promise<UnifiedSearchResult> {
    return timed(this.metrics, 'search.unified', { tenant: tenantId }, async () => {
      const types = parseTypes(dto.types);
      const limit = clampLimit(dto.limit);
      const perTypeCursor = decodeSearchCursor(dto.cursor);
      try {
        const result = await this.viaEngine(tenantId, types, dto.q, limit, perTypeCursor);
        this.metrics.inc('search.unified', { engine: 'opensearch' });
        return result;
      } catch (e) {
        // NullSearchClient ('SEARCH_ENGINE_UNAVAILABLE') or a tripped transport breaker → degrade to Postgres.
        this.log.warn(`search engine unavailable — Postgres fallback (${(e as Error).message})`);
        this.metrics.inc('search.unified', { engine: 'postgres' });
        return this.viaPostgres(tenantId, types, dto.q, limit, perTypeCursor);
      }
    });
  }

  private async viaEngine(tenantId: string, types: SearchType[], text: string, limit: number, cursor: Partial<Record<SearchType, string>>): Promise<UnifiedSearchResult> {
    const groups: Array<{ type: SearchType; hits: RawHit[] }> = [];
    const next: Partial<Record<SearchType, string>> = {};
    for (const type of types) {
      const cfg = INDEX[type];
      const page = await this.engine.query<Record<string, any>>(cfg.logical, {
        tenantId, filter: [], text, textFields: cfg.textFields, sort: 'created_at:desc', limit, cursor: cursor[type],
      });
      groups.push({ type, hits: page.items.map((s) => ({ type, id: String(s.id), title: cfg.title(s), createdAt: String(s.created_at ?? ''), ref: { ...s } })) });
      if (page.nextCursor) next[type] = page.nextCursor;
    }
    return { items: rankHits(groups, text, limit), engine: 'opensearch', nextCursor: encodeSearchCursor(next) ?? null };
  }

  private async viaPostgres(tenantId: string, types: SearchType[], text: string, limit: number, cursor: Partial<Record<SearchType, string>>): Promise<UnifiedSearchResult> {
    const groups: Array<{ type: SearchType; hits: RawHit[] }> = [];
    const next: Partial<Record<SearchType, string>> = {};
    for (const type of types) {
      const r = await this.fallback.fetch(tenantId, type, text, limit, cursor[type]);
      groups.push({ type, hits: r.hits });
      if (r.nextCursor) next[type] = r.nextCursor;
    }
    return { items: rankHits(groups, text, limit), engine: 'postgres', nextCursor: encodeSearchCursor(next) ?? null };
  }
}
