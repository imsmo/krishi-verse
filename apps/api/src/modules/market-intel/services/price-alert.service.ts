// modules/market-intel/services/price-alert.service.ts · a farmer's price-threshold subscriptions (own; RLS'd).
// create/list/toggle act on the caller's own alerts (a non-owner toggle 404s — no IDOR). One ACID tx per write,
// outbox in-tx (Law 4). Evaluation/firing happens on price ingest (see MandiPriceService).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { PriceAlert } from '../domain/price-alert.entity';
import { DomainEvent, AlertDirection } from '../domain/market-intel.events';
import { PriceAlertRepository } from '../repositories/price-alert.repository';
import { PriceAlertNotFoundError } from '../domain/market-intel.errors';
import { MarketActor } from './mandi-price.service';

@Injectable()
export class PriceAlertService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: PriceAlertRepository,
  ) {}

  async create(tenantId: string, actor: MarketActor, dto: { productId: string; regionId?: string | null; direction: string; thresholdMinor: string }) {
    return timed(this.metrics, 'market.alert.create', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const a = PriceAlert.create({ id: uuidv7(), tenantId, userId: actor.userId, productId: dto.productId, regionId: dto.regionId ?? null, direction: dto.direction as AlertDirection, thresholdMinor: BigInt(dto.thresholdMinor) });
        await this.repo.insert(tx, a);
        await this.flush(tx, tenantId, a.id, a.pullEvents());
        return a.toJSON();
      }, { userId: actor.userId }));
  }
  async setActive(tenantId: string, actor: MarketActor, id: string, active: boolean) {
    return this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, tenantId, id);
      if (!a || a.userId !== actor.userId) throw new PriceAlertNotFoundError(id);   // 404 for a non-owner (no IDOR)
      if (active) a.activate(); else a.deactivate();
      await this.repo.update(tx, a);
      return a.toJSON();
    }, { userId: actor.userId });
  }
  async list(tenantId: string, actor: MarketActor, q: { activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listForUser(tenantId, actor.userId, q);
    const items = rows.map((a) => a.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  /** The caller's own alert-trigger activity: how many of their alerts fired today / in the last 7 days (P1-3).
   *  Backed by the append-only trigger log written on ingest (never fabricated; 0 when nothing fired). */
  async activity(tenantId: string, actor: MarketActor): Promise<{ triggeredToday: number; triggeredThisWeek: number }> {
    const c = await this.repo.triggerCounts(tenantId, actor.userId);
    return { triggeredToday: c.today, triggeredThisWeek: c.thisWeek };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'price_alert', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
