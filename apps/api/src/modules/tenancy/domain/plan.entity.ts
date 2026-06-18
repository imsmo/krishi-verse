// modules/tenancy/domain/plan.entity.ts
// Plan aggregate — a PLATFORM-GLOBAL SaaS plan (no tenant_id; the plan catalogue is platform config,
// managed only by platform admins — Law 11 god-mode). Prices in bigint minor units. Carries its
// plan_limits (the dynamic quotas QuotaService resolves). No version optimistic-lock column — the
// service serializes mutations with SELECT … FOR UPDATE (the table's `version` column is the plan's
// grandfathering version, NOT a lock).
import { InvalidPlanError } from './tenancy.errors';
import { BillingCycle } from './tenancy.events';

export interface PlanProps {
  id: string; code: string; version: number; defaultName: string; countryCode: string; currencyCode: string;
  monthlyPriceMinor: bigint; annualPriceMinor: bigint; setupFeeMinor: bigint; isPublic: boolean; isActive: boolean;
  limits: Record<string, bigint>; createdAt: Date;
}
const CODE_RE = /^[a-z0-9_]{2,40}$/;
const LIMIT_RE = /^[a-z0-9_]{2,60}$/;

export class Plan {
  private constructor(private props: PlanProps) {}

  static create(input: { id: string; code: string; version?: number; defaultName: string; countryCode: string; currencyCode: string; monthlyPriceMinor: bigint; annualPriceMinor: bigint; setupFeeMinor?: bigint; isPublic?: boolean; limits?: Record<string, bigint>; now?: Date }): Plan {
    const code = (input.code ?? '').trim().toLowerCase();
    if (!CODE_RE.test(code)) throw new InvalidPlanError('code must be 2..40 chars of a-z 0-9 _');
    if (!input.defaultName?.trim()) throw new InvalidPlanError('name is required');
    if (!/^[A-Z]{2}$/.test(input.countryCode)) throw new InvalidPlanError('countryCode must be ISO-3166 alpha-2');
    if (!/^[A-Z]{3}$/.test(input.currencyCode)) throw new InvalidPlanError('currencyCode must be ISO-4217');
    for (const v of [input.monthlyPriceMinor, input.annualPriceMinor, input.setupFeeMinor ?? 0n]) if (v < 0n) throw new InvalidPlanError('prices cannot be negative');
    const limits = input.limits ?? {};
    for (const [k, v] of Object.entries(limits)) { if (!LIMIT_RE.test(k)) throw new InvalidPlanError(`bad limit code: ${k}`); if (v < -1n) throw new InvalidPlanError('limit must be >= -1 (-1 = unlimited)'); }
    return new Plan({ id: input.id, code, version: input.version ?? 1, defaultName: input.defaultName.trim(), countryCode: input.countryCode, currencyCode: input.currencyCode,
      monthlyPriceMinor: input.monthlyPriceMinor, annualPriceMinor: input.annualPriceMinor, setupFeeMinor: input.setupFeeMinor ?? 0n, isPublic: input.isPublic ?? true, isActive: true, limits, createdAt: input.now ?? new Date() });
  }
  static rehydrate(props: PlanProps): Plan { return new Plan(props); }

  get id() { return this.props.id; }
  get isActive() { return this.props.isActive; }
  get currencyCode() { return this.props.currencyCode; }
  get limits() { return this.props.limits; }
  toProps(): Readonly<PlanProps> { return Object.freeze({ ...this.props }); }

  setActive(active: boolean): void { this.props.isActive = active; }
  priceFor(cycle: BillingCycle): bigint { return cycle === 'annual' ? this.props.annualPriceMinor : this.props.monthlyPriceMinor; }
}
