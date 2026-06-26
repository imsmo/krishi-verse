// modules/listings/services/listing-view.service.ts
// P1-15 · emits a per-impression listing VIEW event onto the high-volume event pipeline. This is the ONLY write
// the view path makes, and it is deliberately tiny: ONE outbox row (`views.listing_viewed`) in a minimal tx — no
// reads, no joins, no business logic, no money. The tailer ships it to kv.views; the stream-processor's
// `view_counter` consumer UPSERT-increments the counted read-model (listing_view_counts) fully OFF-BAND. So
// rendering a listing carries NO synchronous counting/aggregation cost (Done-when: "no synchronous hot-path cost").
//
// The payload is NON-PII by construction: just { v, listingId }. We do NOT record the viewer id here — a raw
// viewer-per-impression stream is a privacy/scale liability; per-unique-viewer rollups are a warehouse concern
// (analytics-pipeline), not faked into this counter. Redelivery dedup is handled downstream by the consumer
// runtime's idempotency store (keyed on the outbox event id) — so a view is counted at-most-once per emit.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics } from '../../../core/observability/metrics';

export const LISTING_VIEWED_EVENT = 'views.listing_viewed';

@Injectable()
export class ListingViewService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  /** Drop ONE view event for (tenant, listing) onto the outbox. Cheap + bounded; counting happens downstream.
   *  Returns void; the controller swallows failures (a lost impression is acceptable — never fail the caller). */
  async record(tenantId: string, listingId: string, viewerUserId: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      await this.outbox.write(tx, {
        tenantId,
        aggregateType: 'listing',
        aggregateId: listingId,
        eventType: LISTING_VIEWED_EVENT,
        payload: { v: 1, listingId },          // NON-PII: no viewer id, no listing content
      });
    }, { userId: viewerUserId });
    this.metrics.inc('listings.view_recorded', { tenant: tenantId });
  }
}
