// modules/search/search.module.ts
// Unified cross-entity search (PRD §D / P1-14). One `GET /v1/search` over the OpenSearch index plane
// (core/search) — fan across the per-entity indices (listings, products, …), merge + rank, federate the cursor.
// Tenant-isolated (the search client injects a mandatory tenant filter; OpenSearch has no RLS). Degrades to a
// Postgres replica fallback when the engine is unconfigured/down (Law 12). Gated by the `unified_search` flag
// (default OFF). The core SearchModule is @Global, so SEARCH_CLIENT is injectable here; no new migration.
import { Module } from '@nestjs/common';
import { SearchController } from './controllers/v1/search.controller';
import { SearchService } from './services/search.service';
import { SearchFallbackReadModel } from './read-models/search-fallback.read-model';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchFallbackReadModel],
  exports: [SearchService],
})
export class UnifiedSearchModule {}
