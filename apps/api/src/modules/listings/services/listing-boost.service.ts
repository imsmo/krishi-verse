// modules/listings/services/listing-boost.service.ts
// Paid visibility boost. Payment is taken via wallet-service (Law 2) BEFORE the
// boost is created; here we record the boost + emit event in one tx.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ListingBoost } from '../domain/listing-boost.entity';
import { ListingBoostRepository } from '../repositories/listing-boost.repository';

@Injectable()
export class ListingBoostService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly repo: ListingBoostRepository,
  ) {}
  async start(tenantId: string, buyerUserId: string, listingId: string, boostTierId: string,
              priceMinor: bigint, currencyCode: string, days: number, paymentTxnId: string): Promise<void> {
    const now = new Date();
    const ends = new Date(now.getTime() + days * 86400_000);
    const boost = ListingBoost.create({ id: uuidv7(), tenantId, listingId, buyerUserId, boostTierId,
      priceMinor, currencyCode, startsAt: now, endsAt: ends, paymentTxnId });
    await this.uow.run(tenantId, async (tx) => {
      await this.repo.insert(tx, boost);
      await this.outbox.write(tx, { tenantId, aggregateType: 'listing', aggregateId: listingId,
        eventType: 'listing.boost_started', payload: { v: 1, listingId, endsAt: ends.toISOString() } });
    }, { userId: buyerUserId });
  }
}
