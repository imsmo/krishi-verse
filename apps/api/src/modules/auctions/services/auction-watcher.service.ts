// modules/auctions/services/auction-watcher.service.ts
// The auction watch-list use-cases (watch / unwatch / list mine). Watching is owner-scoped (the user is
// the caller) and idempotent (composite PK). The auction is resolved within the tenant first — a missing
// auction is 404 (no cross-tenant enumeration). watch emits auctions.watch_started in the SAME tx
// (Law 4) so notifications/analytics can react. Reads on the replica (CQRS); bounded + keyset-paginated.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuctionWatcher } from '../domain/auction-watcher.entity';
import { AuctionNotFoundError } from '../domain/auctions.errors';
import { AuctionRepository } from '../repositories/auction.repository';
import { AuctionWatcherRepository } from '../repositories/auction-watcher.repository';
import { AuctionsPublisher } from '../events/auctions.publisher';

const enc = (s: string) => Buffer.from(s).toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

@Injectable()
export class AuctionWatcherService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly auctions: AuctionRepository,
    private readonly watchers: AuctionWatcherRepository,
    private readonly publisher: AuctionsPublisher,
  ) {}

  async watch(tenantId: string, userId: string, auctionId: string) {
    return timed(this.metrics, 'auctions.watch', { tenant: tenantId }, async () => {
      const a = await this.auctions.getVisible(tenantId, auctionId);
      if (!a) throw new AuctionNotFoundError(auctionId);           // 404, not 403 — no enumeration
      await this.uow.run(tenantId, async (tx) => {
        const w = AuctionWatcher.of({ auctionId, userId });
        await this.watchers.watch(tx, w);
        await this.publisher.watchStarted(tx, tenantId, auctionId, userId);   // idempotent at the consumer
      }, { userId });
      return { ok: true, auctionId, watching: true };
    });
  }

  async unwatch(tenantId: string, userId: string, auctionId: string) {
    await this.uow.run(tenantId, async (tx) => { await this.watchers.unwatch(tx, auctionId, userId); }, { userId });
    return { ok: true, auctionId, watching: false };
  }

  async listMine(tenantId: string, userId: string, q: { cursor?: string; limit: number }) {
    let cursor: { c: string; id: string } | undefined;
    if (q.cursor) { try { cursor = JSON.parse(dec(q.cursor)); } catch { /* first page */ } }
    const rows = await this.watchers.listForUser(tenantId, userId, { cursor, limit: q.limit + 1 });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const items = page.map((r) => ({ auctionId: r.auctionId, status: r.status, endsAt: r.endsAt, watchedAt: r.createdAt }));
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? enc(JSON.stringify({ c: new Date(last.createdAt).toISOString(), id: last.auctionId })) : null;
    return { items, nextCursor };
  }
}
