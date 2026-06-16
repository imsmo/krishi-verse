// modules/identity/jobs/risk-score-recompute.job.ts · worker job: recompute per-user trust
// score from accumulated risk_events (base 70 + weighted signals, clamped 0–100 → band).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { RiskScoreRepository } from '../repositories/risk-score.repository';
import { RiskScore } from '../domain/risk-score.entity';

const BASE = 70;

@Injectable()
export class RiskScoreRecomputeJob {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, private readonly risk: RiskScoreRepository) {}
  async runForTenant(tenantId: string): Promise<number> {
    return this.uow.run(tenantId, async (tx) => {
      const agg = await tx.query<{ user_id: string; total: string }>(
        `SELECT user_id, COALESCE(SUM(weight),0) AS total FROM risk_events
          WHERE tenant_id = $1 AND created_at > now() - interval '180 days' GROUP BY user_id LIMIT 5000`, [tenantId]);
      for (const r of agg.rows) {
        const score = BASE + Number(r.total);
        await this.risk.upsert(tx, RiskScore.of({ id: '', tenantId, userId: r.user_id, score, factors: { window_days: 180, weighted_total: Number(r.total) } }));
      }
      return agg.rows.length;
    });
  }
}
