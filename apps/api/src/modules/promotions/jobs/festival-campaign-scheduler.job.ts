// modules/promotions/jobs/festival-campaign-scheduler.job.ts
// Worker job (kv_relay): auto-opens and auto-closes 'festival' promotions on their schedule. A festival
// campaign is authored with a [starts_at, ends_at] window; this sweep flips is_active to match the window
// as time passes (activate when it opens, pause when it closes) so tenants don't have to toggle manually.
// Claims festival promotions whose is_active disagrees with the window across tenants (SKIP LOCKED,
// bounded), then aligns each via PromotionService (its own tx + outbox). IDEMPOTENT: a promotion already
// aligned with its window is never re-claimed. NOT a DI provider — apps/worker instantiates it with the
// kv_relay Pool + the repo + PromotionService.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { PromotionRepository } from '../repositories/promotion.repository';
import { PromotionService } from '../services/promotion.service';

export class FestivalCampaignSchedulerJob {
  constructor(private readonly systemPool: Pool, private readonly repo: PromotionRepository, private readonly promotions: PromotionService) {}

  async run(limit = 200): Promise<{ scanned: number; changed: number; failed: number }> {
    const now = new Date();
    const client = await this.systemPool.connect();
    let toggles: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      toggles = await this.repo.findFestivalToggles(tx, now, limit);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let changed = 0, failed = 0;
    for (const p of toggles) { try { if ((await this.promotions.applyScheduleWindow(p.tenantId, p.id, now)).changed) changed++; } catch { failed++; } }
    return { scanned: toggles.length, changed, failed };
  }
}
