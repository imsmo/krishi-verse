// modules/requirements/jobs/expire-requirements.job.ts
// Worker job (kv_relay): lapse requirements past need_by AND quotes past valid_until. Claims across
// tenants (FOR UPDATE SKIP LOCKED), bounded per tick; each expire() is idempotent (skips non-live).
// NOT a DI provider — instantiated by apps/worker (or tests) with the privileged kv_relay Pool,
// mirroring the auction/offer expiry jobs.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { RequirementRepository } from '../repositories/requirement.repository';
import { RequirementResponseRepository } from '../repositories/requirement-response.repository';
import { RequirementService } from '../services/requirement.service';
import { RequirementResponseService } from '../services/requirement-response.service';

export class ExpireRequirementsJob {
  constructor(
    private readonly systemPool: Pool,
    private readonly reqRepo: RequirementRepository,
    private readonly respRepo: RequirementResponseRepository,
    private readonly requirements: RequirementService,
    private readonly responses: RequirementResponseService,
  ) {}

  async run(limit = 200): Promise<{ requirements: number; responses: number; failed: number }> {
    const now = new Date();
    const dueReqs = await this.claim((tx) => this.reqRepo.findDueToExpire(tx, now, limit));
    const dueResps = await this.claim((tx) => this.respRepo.findDueToExpire(tx, now, limit));
    let requirements = 0, responses = 0, failed = 0;
    for (const d of dueReqs) { try { await this.requirements.expire(d.tenantId, d.id); requirements++; } catch { failed++; } }
    for (const d of dueResps) { try { await this.responses.expireResponse(d.tenantId, d.id); responses++; } catch { failed++; } }
    return { requirements, responses, failed };
  }

  private async claim<T extends { id: string; toProps(): { tenantId: string } }>(find: (tx: TxContext) => Promise<T[]>): Promise<Array<{ id: string; tenantId: string }>> {
    const client = await this.systemPool.connect();
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      const rows = await find(tx);
      await client.query('COMMIT');
      return rows.map((r) => ({ id: r.id, tenantId: r.toProps().tenantId }));
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
  }
}
