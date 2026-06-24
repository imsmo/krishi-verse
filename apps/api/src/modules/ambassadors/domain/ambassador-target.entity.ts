// modules/ambassadors/domain/ambassador-target.entity.ts · a per-period goal for one metric (PRD §16.10).
// PURE. An admin sets a target (e.g. 20 onboardings this month); the leaderboard read-model compares actuals
// against it. `target_value` is a COUNT for count metrics and bigint MINOR units for 'earnings_minor' (Law 2).
import { AmbassadorEventType, DomainEvent } from './ambassadors.events';

export const TARGET_METRICS = ['onboardings', 'sales_facilitated', 'earnings_minor', 'visits'] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

export interface AmbassadorTargetProps {
  id: string; tenantId: string; ambassadorId: string; metric: TargetMetric;
  periodStart: string; periodEnd: string; targetValue: bigint; createdAt?: Date;
}

export class AmbassadorTarget {
  private readonly events: DomainEvent[] = [];
  private constructor(private readonly props: AmbassadorTargetProps) {}

  static set(input: Omit<AmbassadorTargetProps, 'createdAt'>): AmbassadorTarget {
    if (input.periodEnd < input.periodStart) throw new Error('period_end must be >= period_start');
    if (input.targetValue < 0n) throw new Error('target_value must be >= 0');
    const t = new AmbassadorTarget(input);
    t.events.push({ type: AmbassadorEventType.TargetSet, payload: { targetId: t.props.id, ambassadorId: t.props.ambassadorId, metric: t.props.metric } });
    return t;
  }
  static rehydrate(props: AmbassadorTargetProps): AmbassadorTarget { return new AmbassadorTarget(props); }

  get id() { return this.props.id; }
  toProps(): AmbassadorTargetProps { return { ...this.props }; }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() {
    const p = this.props;
    return { id: p.id, ambassadorId: p.ambassadorId, metric: p.metric, periodStart: p.periodStart,
      periodEnd: p.periodEnd, targetValue: p.targetValue.toString(), createdAt: p.createdAt };
  }
}
