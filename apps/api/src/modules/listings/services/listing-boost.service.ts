// modules/listings/services/listing-boost.service.ts
// Paid visibility boost (revenue stream #4). Two ways to pay:
//  - start(): the caller already captured payment elsewhere and passes a wallet txnId (legacy/gateway path).
//  - payFromWallet(): the server resolves the tier's AUTHORITATIVE price (lookup meta — never trust a client
//    price), debits the buyer's wallet → platform fees in ONE tx (Law 11), then records the boost + event.
// Money minor units (Law 1); idempotent (Law 3). The boost-tier catalogue (tiers) is a read of seeded meta.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { platform, userMain, PlatformAccount } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { BadRequestError } from '../../../shared/errors/app-error';
import { ListingBoost } from '../domain/listing-boost.entity';
import { ListingBoostRepository } from '../repositories/listing-boost.repository';

@Injectable()
export class ListingBoostService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly repo: ListingBoostRepository,
  ) {}

  /** The boost-tier catalogue (id + name + server price/days) so the client shows real prices, never a UUID. */
  tiers(tenantId: string) { return this.repo.listTiers(tenantId); }

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

  /** Pay for a boost straight from the buyer's wallet: resolve the tier price SERVER-SIDE, debit the
   *  buyer → platform fees (boost is platform revenue, not escrow), then record the boost. Idempotent. */
  async payFromWallet(tenantId: string, buyerUserId: string, idemKey: string, listingId: string, boostTierId: string, currencyCode = 'INR') {
    const tier = await this.repo.getTier(tenantId, boostTierId);
    if (!tier) throw new BadRequestError('Unknown or inactive boost tier');
    return this.idem.remember(idemKey, buyerUserId, 'listings.boost_pay_from_wallet', () =>
      timed(this.metrics, 'listings.boost_pay_from_wallet', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const now = new Date();
          const ends = new Date(now.getTime() + tier.days * 86400_000);
          const id = uuidv7();
          // money MOVES (Law 11): buyer wallet → platform fees, idempotent on the boost id.
          const txn = await this.wallet.post(tx, {
            tenantId, txnType: 'listing_boost', idempotencyKey: `boostpay:${id}`,
            referenceType: 'listing_boost', referenceId: id, initiatedBy: buyerUserId,
            legs: [
              { account: platform(PlatformAccount.Fees, currencyCode), amountMinor: tier.priceMinor },
              { account: userMain(buyerUserId, currencyCode), amountMinor: -tier.priceMinor },
            ],
          });
          const boost = ListingBoost.create({ id, tenantId, listingId, buyerUserId, boostTierId,
            priceMinor: tier.priceMinor, currencyCode, startsAt: now, endsAt: ends, paymentTxnId: txn.txnId });
          await this.repo.insert(tx, boost);
          await this.outbox.write(tx, { tenantId, aggregateType: 'listing', aggregateId: listingId,
            eventType: 'listing.boost_started', payload: { v: 1, listingId, endsAt: ends.toISOString() } });
          return { ok: true, boostId: id, endsAt: ends.toISOString(), priceMinor: tier.priceMinor.toString(), days: tier.days, txnId: txn.txnId };
        }, { userId: buyerUserId })));
  }
}
