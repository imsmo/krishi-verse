// modules/tenancy/domain/usage-counter.entity.ts · a per-tenant metered usage counter (0015 usage_counters).
// Pure TS. READ-ONLY here: counters are incremented by the core quota/metering path (UPSERT) and checked against
// plan_limits — the self-serve plane only READS them for the "my usage this period" dashboard. used_value is a
// non-negative bigint (a count, not money). Tenant-scoped.
export interface UsageCounterProps { tenantId: string; metricCode: string; period: string; usedValue: bigint; }

export class UsageCounter {
  private constructor(private p: UsageCounterProps) {}
  static rehydrate(p: UsageCounterProps): UsageCounter { return new UsageCounter(p); }

  /** Fraction of a plan limit consumed (limit -1 = unlimited → 0; limit 0 → 1 if any usage). For dashboards/alerts. */
  ratioOf(limit: bigint): number {
    if (limit < 0n) return 0;                       // unlimited
    if (limit === 0n) return this.p.usedValue > 0n ? 1 : 0;
    return Number(this.p.usedValue) / Number(limit);
  }
  toProps(): Readonly<UsageCounterProps> { return Object.freeze({ ...this.p }); }
  toJSON() { return { metricCode: this.p.metricCode, period: this.p.period, usedValue: this.p.usedValue.toString() }; }
}
