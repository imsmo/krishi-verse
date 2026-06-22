// modules/requirements/events/handlers/listing-published.handler.ts
// Consumes listing.published (delivered by the outbox relay). When a seller publishes a listing, nudge
// the buyers whose OPEN requirements match it (same product or category) so the reverse-marketplace
// closes the loop. The listing's matchable attributes (productId, categoryId, sellerUserId) travel IN
// the event, so this NEVER reads the listings module's tables (Law 11). Emits one
// `requirements.requirement_matched` per matched requirement (recipient = the requirement's buyer);
// communication fans it out. BOUNDED: matches are capped (LIMIT) so a hot category can't trigger
// unbounded write-amplification (§4/§5). IDEMPOTENT: the relay commits the handler's emits atomically
// with marking THIS listing.published event published, so a successful run is delivered once; the
// buyer's own requirement (if they're also the seller) is excluded.
import { Inject, Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { OUTBOX_WRITER, OutboxWriter } from '../../../../core/outbox/outbox.writer';
import { TxContext } from '../../../../core/database/unit-of-work';
import { RequirementRepository } from '../../repositories/requirement.repository';
import { RequirementEventType } from '../../domain/requirements.events';

const MATCH_LIMIT = 50;   // cap the fan-out per published listing

@Injectable()
export class ListingPublishedHandler implements OutboxHandler {
  readonly eventType = 'listing.published';
  constructor(
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly requirements: RequirementRepository,
  ) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    if (!tenantId) return;
    const listingId = typeof p.listingId === 'string' ? p.listingId : event.aggregateId;
    const productId = typeof p.productId === 'string' ? p.productId : null;
    const categoryId = typeof p.categoryId === 'string' ? p.categoryId : null;
    const sellerUserId = typeof p.sellerUserId === 'string' ? p.sellerUserId : undefined;
    if (!productId && !categoryId) return;   // nothing to match on

    const matches = await this.requirements.findOpenMatching(tx, tenantId, { productId, categoryId, excludeUserId: sellerUserId }, MATCH_LIMIT);
    for (const m of matches) {
      await this.outbox.write(tx, {
        tenantId, aggregateType: 'requirement', aggregateId: m.id, eventType: RequirementEventType.Matched,
        payload: { v: 1, requirementId: m.id, buyerUserId: m.buyerUserId, listingId, productId, categoryId },
      });
    }
  }
}
