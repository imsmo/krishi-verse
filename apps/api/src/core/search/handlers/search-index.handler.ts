// core/search/handlers/search-index.handler.ts · the outbox→OpenSearch projection handler. One instance is
// registered per indexed eventType (created/published/updated/…); the relay delivers the event inside its
// per-event tx and this handler RE-READS the affected aggregate (via that tx — the relay runs on the BYPASSRLS
// kv_relay pool, so it can read any tenant's row) and upserts-or-drops the search doc. Idempotent (upsert/delete
// by id) — safe under the relay's at-least-once delivery. Flag-gated kill switch (`search_indexing`, default
// OFF, Law 10): when off, the handler is a no-op and the index simply lags until re-enabled + reindexed.
import { OutboxEvent, OutboxHandler } from '../../outbox/event-envelope';
import { TxContext } from '../../database/unit-of-work';
import { FlagsService } from '../../feature-flags/flags.service';
import { IndexBuilderService } from '../index-builder.service';
import { indicesForEvent } from '../indices/index-registry';

export class SearchIndexHandler implements OutboxHandler {
  constructor(
    public readonly eventType: string,
    private readonly builder: IndexBuilderService,
    private readonly flags: FlagsService,
  ) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    if (!this.builder.enabled) return;                                 // no search engine configured → no-op
    if (!(await this.flags.isEnabled('search_indexing'))) return;      // kill switch (default OFF)
    for (const def of indicesForEvent(event.eventType)) {
      await this.builder.syncById(tx, def, event.aggregateId);         // re-read current row → upsert or delete
    }
  }
}
