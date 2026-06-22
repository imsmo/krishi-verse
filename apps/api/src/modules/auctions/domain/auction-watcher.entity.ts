// modules/auctions/domain/auction-watcher.entity.ts · a user watching an auction (for outbid /
// ending-soon / won notifications). Pure value object: the composite identity is (auctionId, userId)
// — the table PK — so watching is idempotent. No money, no status machine.
export interface AuctionWatcherProps { auctionId: string; userId: string; createdAt: Date; }

export class AuctionWatcher {
  private constructor(readonly props: AuctionWatcherProps) {}
  static of(input: { auctionId: string; userId: string; now?: Date }): AuctionWatcher {
    if (!input.auctionId || !input.userId) throw new Error('auctionId and userId are required');
    return new AuctionWatcher({ auctionId: input.auctionId, userId: input.userId, createdAt: input.now ?? new Date() });
  }
}
