// core/search/search.client.null.ts
// Phase-1 SearchClient binding. Full-text/relevance search via OpenSearch is a
// Phase-2 projection (event-driven, built off the outbox). Until then the
// listings read-model queries the read REPLICA directly (still CQRS-correct —
// reads never hit the write primary). This NullSearchClient signals "no engine"
// so any caller falls back to the DB path.
import { Injectable } from '@nestjs/common';
import { SearchClient, SearchQuery, SearchPage } from './search.client';

@Injectable()
export class NullSearchClient extends SearchClient {
  async query<T = any>(_index: string, _q: SearchQuery): Promise<SearchPage<T>> {
    throw new Error('SEARCH_ENGINE_UNAVAILABLE'); // callers fall back to replica
  }
}
