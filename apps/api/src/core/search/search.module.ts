// core/search/search.module.ts
// Binds SEARCH_CLIENT. Phase 1 uses the NullSearchClient (read-models query the
// replica directly). Phase 2 swaps in an OpenSearch-backed client fed by the
// outbox — same token, no caller changes.
import { Global, Module } from '@nestjs/common';
import { SEARCH_CLIENT } from './search.client';
import { NullSearchClient } from './search.client.null';

@Global()
@Module({
  providers: [{ provide: SEARCH_CLIENT, useClass: NullSearchClient }],
  exports: [SEARCH_CLIENT],
})
export class SearchModule {}
