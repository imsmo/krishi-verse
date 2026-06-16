// modules/identity/domain/risk-score.entity.ts · per-user trust score (0–100) → band.
export type RiskBand = 'trusted' | 'standard' | 'caution' | 'restricted' | 'blocked';
export interface RiskScoreProps { id: string; tenantId: string | null; userId: string; score: number; band: RiskBand; factors: Record<string, unknown>; }
export function bandFor(score: number): RiskBand {
  if (score >= 80) return 'trusted';
  if (score >= 60) return 'standard';
  if (score >= 40) return 'caution';
  if (score >= 20) return 'restricted';
  return 'blocked';
}
export class RiskScore {
  constructor(readonly props: RiskScoreProps) {}
  static of(input: { id: string; tenantId: string | null; userId: string; score: number; factors?: Record<string, unknown> }): RiskScore {
    const score = Math.max(0, Math.min(100, Math.round(input.score)));
    return new RiskScore({ id: input.id, tenantId: input.tenantId, userId: input.userId, score, band: bandFor(score), factors: input.factors ?? {} });
  }
}
