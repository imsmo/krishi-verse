// modules/identity/repositories/risk-score.repository.ts · per-user trust score + risk events.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { RiskScore } from '../domain/risk-score.entity';

@Injectable()
export class RiskScoreRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async upsert(tx: TxContext, s: RiskScore): Promise<void> {
    const p = s.props;
    await tx.query(
      `INSERT INTO risk_scores (id, tenant_id, user_id, score, band, factors, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb, now())
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET score=EXCLUDED.score, band=EXCLUDED.band, factors=EXCLUDED.factors, computed_at=now()`,
      [uuidv7(), p.tenantId, p.userId, p.score, p.band, JSON.stringify(p.factors)]);
  }
  async recordEvent(tx: TxContext, e: { tenantId: string | null; userId: string; eventCode: string; weight: number; referenceType?: string; referenceId?: string; meta?: Record<string, unknown> }): Promise<void> {
    await tx.query(
      `INSERT INTO risk_events (id, tenant_id, user_id, event_code, weight, reference_type, reference_id, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [uuidv7(), e.tenantId, e.userId, e.eventCode, e.weight, e.referenceType ?? null, e.referenceId ?? null, JSON.stringify(e.meta ?? {})]);
  }
  async findByUser(tenantId: string, userId: string): Promise<{ score: number; band: string } | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT score, band FROM risk_scores WHERE tenant_id IS NOT DISTINCT FROM $1 AND user_id=$2`, [tenantId, userId]);
    return r.rows[0] ?? null;
  }
}
