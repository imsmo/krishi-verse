// modules/auctions/read-models/auction-live.read-model.ts
// Read-side (replica, CQRS): the bid history for an auction, cursor-paginated. SEALED auctions hide
// other bidders' amounts until the auction has ended (a bidder always sees their OWN bids); open
// (english) auctions show everything. Tenant-scoped (RLS); no money mutations here.
import { Inject, Injectable } from '@nestjs/common';
import { METRICS, Metrics } from '../../../core/observability/metrics';
import { AuctionRepository } from '../repositories/auction.repository';
import { BidRepository } from '../repositories/bid.repository';
import { AuctionNotFoundError } from '../domain/auctions.errors';

@Injectable()
export class AuctionLiveReadModel {
  constructor(@Inject(METRICS) private readonly metrics: Metrics, private readonly auctions: AuctionRepository, private readonly bids: BidRepository) {}

  async bidHistory(tenantId: string, viewerUserId: string, auctionId: string, opts: { cursor?: { c: string; id: string }; limit: number }) {
    const a = await this.auctions.getVisible(tenantId, auctionId);
    if (!a) throw new AuctionNotFoundError(auctionId);
    const p = a.toProps();
    const sealedHidden = p.kind === 'sealed' && !['ended', 'settled', 'failed_reserve', 'cancelled', 'awaiting_approval'].includes(p.status);

    const rows = await this.bids.listFor(tenantId, auctionId, opts);
    const items = rows.map((b) => ({
      id: b.id,
      bidderUserId: b.bidderUserId,
      amountMinor: sealedHidden && b.bidderUserId !== viewerUserId ? null : b.amountMinor,  // mask others' sealed bids
      createdAt: b.createdAt,
    }));
    const last = rows[rows.length - 1];
    this.metrics.inc('auctions.bid_history', { tenant: tenantId });
    return { items, nextCursor: rows.length === opts.limit && last ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64') : null };
  }
}
