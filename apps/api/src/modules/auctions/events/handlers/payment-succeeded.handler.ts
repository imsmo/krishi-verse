// modules/auctions/events/handlers/payment-succeeded.handler.ts
// Consumes payments.payment_succeeded (delivered by the outbox relay). Acts ONLY on payments whose
// referenceType is 'auction' — i.e. the WINNER settling their auction win directly against the auction
// (referenceId = auctionId). On success it RELEASES the winner's EMD hold (hold → main) via the wallet
// boundary (Law 2): once they've actually paid, the anti-spam deposit is returned. Idempotent on the
// wallet key `emd-release:<auction>:<winner>` (the same key the close path uses), so a re-delivery — or
// a winner whose EMD was already released at close — is a harmless no-op. Touches ONLY auctions' own
// tables + the wallet (Law 11). Runs inside the relay's per-event tx.
import { Inject, Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxHandler } from '../../../../core/outbox/event-envelope';
import { TxContext } from '../../../../core/database/unit-of-work';
import { WALLET_SERVICE, WalletPort } from '../../../../core/wallet/wallet.port';
import { userMain, userHold } from '../../../../core/wallet/account-codes';
import { AuctionRepository } from '../../repositories/auction.repository';
import { BidRepository } from '../../repositories/bid.repository';
import { AuctionsPublisher } from '../auctions.publisher';

@Injectable()
export class AuctionPaymentSucceededHandler implements OutboxHandler {
  readonly eventType = 'payments.payment_succeeded';
  constructor(
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly auctions: AuctionRepository,
    private readonly bids: BidRepository,
    private readonly publisher: AuctionsPublisher,
  ) {}

  async handle(event: OutboxEvent, tx: TxContext): Promise<void> {
    const tenantId = event.tenantId;
    const p = event.payload as Record<string, unknown>;
    if (!tenantId || p.referenceType !== 'auction') return;          // only a direct auction settlement
    const auctionId = typeof p.referenceId === 'string' ? p.referenceId : undefined;
    if (!auctionId) return;

    const a = await this.auctions.getForUpdate(tx, tenantId, auctionId);
    if (!a) return;
    const winningBidId = a.toProps().winningBidId;
    if (!winningBidId) return;                                        // no winner → nothing to settle
    const winnerUserId = await this.bids.bidderOfBid(tx, tenantId, winningBidId);
    if (!winnerUserId) return;

    const first = (await this.bids.firstBidAmounts(tx, tenantId, auctionId)).find((f) => f.bidderUserId === winnerUserId);
    if (!first) return;
    const emd = a.emdForBid(first.firstAmountMinor);
    if (emd <= 0n) return;

    // return the winner's held EMD — idempotent on the shared release key (no double-release)
    await this.wallet.post(tx, {
      tenantId, txnType: 'emd_hold', idempotencyKey: `emd-release:${auctionId}:${winnerUserId}`, referenceType: 'auction', referenceId: auctionId, initiatedBy: 'system',
      legs: [ { account: userHold(winnerUserId), amountMinor: -emd }, { account: userMain(winnerUserId), amountMinor: emd } ],
    });
    await this.publisher.emdReleased(tx, tenantId, auctionId, winnerUserId, emd);
  }
}
