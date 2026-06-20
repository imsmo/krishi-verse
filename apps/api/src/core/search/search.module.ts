// core/search/search.module.ts · binds the search platform. CONFIG-DRIVEN (Law 12): when OPENSEARCH_URL is set,
// SEARCH_CLIENT is the real OpenSearch client and the outbox→index projection handlers are registered (one per
// indexed eventType) so writes keep the indices in sync; the indices are created at boot (best-effort — a down
// cluster never blocks API startup). When OPENSEARCH_URL is absent, it falls back to NullSearchClient and read-
// models query the replica directly (same SEARCH_CLIENT token — no caller changes). The projection itself is
// also gated by the `search_indexing` flag (default OFF) as a runtime kill switch.
import { Global, Module, OnModuleInit, Inject } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { FlagsService } from '../feature-flags/flags.service';
import { OUTBOX_HANDLER_REGISTRY } from '../outbox/event-envelope';
import { OutboxHandlerRegistry } from '../outbox/outbox.dispatcher';
import { SEARCH_CLIENT } from './search.client';
import { NullSearchClient } from './search.client.null';
import { OpenSearchSearchClient } from './opensearch.client';
import { OpenSearchTransport } from './opensearch.transport';
import { IndexBuilderService } from './index-builder.service';
import { SearchIndexHandler } from './handlers/search-index.handler';
import { ALL_INDEXED_EVENT_TYPES } from './indices/index-registry';

@Global()
@Module({
  providers: [
    OpenSearchTransport,
    IndexBuilderService,
    {
      provide: SEARCH_CLIENT,
      useFactory: (config: AppConfig, transport: OpenSearchTransport) =>
        config.search.url ? new OpenSearchSearchClient(transport) : new NullSearchClient(),
      inject: [AppConfig, OpenSearchTransport],
    },
  ],
  exports: [SEARCH_CLIENT, OpenSearchTransport, IndexBuilderService],
})
export class SearchModule implements OnModuleInit {
  constructor(
    private readonly builder: IndexBuilderService,
    private readonly flags: FlagsService,
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.builder.enabled) return;                                  // no OpenSearch configured → replica path
    for (const eventType of ALL_INDEXED_EVENT_TYPES) {
      this.registry.register(new SearchIndexHandler(eventType, this.builder, this.flags));
    }
    void this.builder.ensureIndices().catch(() => undefined);           // best-effort: never block boot on search
  }
}
