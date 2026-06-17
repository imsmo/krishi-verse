// modules/auctions/services/auction.service.ts
// Auction lifecycle use-cases. Every write: one ACID tx (UoW), state via the machine (Law 5),
// outbox events in the SAME tx (Law 4), audit on admin actions. EMD (earnest money) is held/released
// ONLY via the wallet boundary (Law 2). Seller authority is resolved from the listing (Law 11 — we
// call ListingService, never the listings repository).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain, userHold } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ListingService } from '../../listings/services/listing.service';
import { Auction } from '../domain/auction.entity';
import { DomainEvent } from '../domain/auctions.events';
import { AuctionNotFoundError, AuctionForbiddenError, AuctionConcurrencyError, InvalidAuctionError } from '../domain/auctions.errors';
import { AuctionRepository } from '../repositories/auction.repository';
import { BidRepository } from '../repositories/bid.repository';

export interface AuctionActor { userId: string; canModerate: boolean; }

@Injectable()
export class AuctionService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly audit: AuditWriter,
    private readonly listings: ListingService,
    private readonly repo: AuctionRepository,
    private readonly bids: BidRepository,
  ) {}

  private async sellerOf(tenantId: string, listingId: string): Promise<string> {
    const l: any = await this.listings.getById(tenantId, listingId);
    if (!l) throw new InvalidAuctionError('listing not found');
    return l.sellerUserId;
  }

  /** A seller opens an auction on THEIR published listing. */
  async create(tenantId: string, sellerUserId: string, idemKey: string, dto: any) {
    return this.idem.remember(idemKey, sellerUserId, 'auctions.create', () =>
      timed(this.metrics, 'auctions.create', { tenant: tenantId }, async () => {
        const l: any = await this.listings.getById(tenantId, dto.listingId);
        if (!l || l.status !== 'published') throw new InvalidAuctionError('listing not found or not published');
        if (l.sellerUserId !== sellerUserId) throw new AuctionForbiddenError('only the listing seller can auction it');
        const auction = Auction.create({
          id: uuidv7(), tenantId, listingId: dto.listingId, kind: dto.kind, startPriceMinor: BigInt(dto.startPriceMinor),
          reservePriceMinor: dto.reservePriceMinor ? BigInt(dto.reservePriceMinor) : null, minIncrementMinor: dto.minIncrementMinor ? BigInt(dto.minIncrementMinor) : undefined,
          emdMinor: dto.emdMinor ? BigInt(dto.emdMinor) : undefined, emdPctBps: dto.emdPctBps ?? null,
          startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt), autoExtendSecs: dto.autoExtendSecs, extendTriggerSecs: dto.extendTriggerSecs,
          minBidders: dto.minBidders ?? null, requiresSellerApproval: dto.requiresSellerApproval,
        });
        return this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, auction);
          const p = auction.toProps();
          await this.repo.recordEvent(tx, tenantId, p.id, 'created');
          await this.flush(tx, tenantId, p.id, auction.pullEvents());
          return { auctionId: p.id, listingId: p.listingId, status: p.status, startsAt: p.startsAt, endsAt: p.endsAt };
        }, { userId: sellerUserId });
      }));
  }

  /** Open a scheduled auction (worker job, at starts_at). Idempotent (skips if not scheduled). */
  async open(tenantId: string, auctionId: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, auctionId);
      if (!a || a.status !== 'scheduled') return;
      a.open();
      if (!(await this.repo.update(tx, a))) throw new AuctionConcurrencyError(auctionId);
      await this.repo.recordEvent(tx, tenantId, auctionId, 'opened');
      await this.flush(tx, tenantId, auctionId, a.pullEvents());
    }, { userId: 'system' });
  }

  /** Close a due auction, resolve the winner, and RELEASE every bidder's EMD (worker job). */
  async closeAndResolve(tenantId: string, auctionId: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, auctionId);
      if (!a || (a.status !== 'live' && a.status !== 'extended')) return;
      const highest = await this.bids.highest(tx, tenantId, auctionId);
      const bidderCount = await this.bids.distinctBidderCount(tx, tenantId, auctionId);
      a.closeBidding();
      a.resolve(highest ? { amountMinor: highest.amountMinor, bidId: highest.id } : null, bidderCount);
      if (!(await this.repo.update(tx, a))) throw new AuctionConcurrencyError(auctionId);
      await this.releaseAllEmd(tx, tenantId, auctionId, a);
      await this.repo.recordEvent(tx, tenantId, auctionId, 'ended', { status: a.status });
      await this.flush(tx, tenantId, auctionId, a.pullEvents());
    }, { userId: 'system' });
  }

  async approve(tenantId: string, actor: AuctionActor, auctionId: string, ip: string | null): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, auctionId);
      if (!a) throw new AuctionNotFoundError(auctionId);
      await this.assertSellerOrModerator(tenantId, a.listingId, actor);
      if (a.status !== 'awaiting_approval') throw new InvalidAuctionError('auction is not awaiting approval');
      const highest = await this.bids.highest(tx, tenantId, auctionId);
      if (!highest) throw new InvalidAuctionError('no winning bid');
      a.approve({ amountMinor: highest.amountMinor, bidId: highest.id });
      if (!(await this.repo.update(tx, a))) throw new AuctionConcurrencyError(auctionId);
      await this.releaseAllEmd(tx, tenantId, auctionId, a);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'auction.approved', entityType: 'auction', entityId: auctionId, newValue: { winningBidId: highest.id }, ip });
      await this.flush(tx, tenantId, auctionId, a.pullEvents());
    }, { userId: actor.userId });
  }

  async cancel(tenantId: string, actor: AuctionActor, auctionId: string, ip: string | null): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, auctionId);
      if (!a) throw new AuctionNotFoundError(auctionId);
      await this.assertSellerOrModerator(tenantId, a.listingId, actor);
      a.cancel();
      if (!(await this.repo.update(tx, a))) throw new AuctionConcurrencyError(auctionId);
      await this.releaseAllEmd(tx, tenantId, auctionId, a);
      await this.repo.recordEvent(tx, tenantId, auctionId, 'cancelled');
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'auction.cancelled', entityType: 'auction', entityId: auctionId, newValue: {}, ip });
      await this.flush(tx, tenantId, auctionId, a.pullEvents());
    }, { userId: actor.userId });
  }

  async getById(tenantId: string, auctionId: string) {
    const a = await this.repo.getVisible(tenantId, auctionId);
    if (!a) throw new AuctionNotFoundError(auctionId);
    return this.serialize(a.toProps());
  }

  async list(tenantId: string, q: { status?: string; cursor?: { c: string; id: string }; limit: number }) {
    const items = (await this.repo.listFor(tenantId, q)).map((a) => this.serialize(a.toProps()));
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? (last as any).createdAt}|${last.auctionId}`).toString('base64') : null };
  }

  private serialize(p: ReturnType<Auction['toProps']>) {
    return { auctionId: p.id, listingId: p.listingId, kind: p.kind, status: p.status, startPriceMinor: p.startPriceMinor.toString(),
      reservePriceMinor: p.reservePriceMinor?.toString() ?? null, minIncrementMinor: p.minIncrementMinor.toString(),
      startsAt: p.startsAt, endsAt: p.endsAt, winningBidId: p.winningBidId, createdAt: p.createdAt };
  }

  /** Release each bidder's held EMD (hold → main) — idempotent per (auction, bidder). */
  private async releaseAllEmd(tx: TxContext, tenantId: string, auctionId: string, a: Auction): Promise<void> {
    for (const f of await this.bids.firstBidAmounts(tx, tenantId, auctionId)) {
      const emd = a.emdForBid(f.firstAmountMinor);
      if (emd <= 0n) continue;
      await this.wallet.post(tx, { tenantId, txnType: 'emd_hold', idempotencyKey: `emd-release:${auctionId}:${f.bidderUserId}`, referenceType: 'auction', referenceId: auctionId, initiatedBy: 'system',
        legs: [ { account: userHold(f.bidderUserId), amountMinor: -emd }, { account: userMain(f.bidderUserId), amountMinor: emd } ] });
    }
  }

  private async assertSellerOrModerator(tenantId: string, listingId: string, actor: AuctionActor): Promise<void> {
    if (actor.canModerate) return;
    const seller = await this.sellerOf(tenantId, listingId);
    if (seller !== actor.userId) throw new AuctionForbiddenError();
  }

  private async flush(tx: TxContext, tenantId: string, auctionId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'auction', aggregateId: auctionId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
