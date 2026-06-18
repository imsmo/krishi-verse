// modules/memberships/domain/membership-tier.entity.ts
// MembershipTier aggregate — a subscription plan (free or paid) with a benefits bundle. Pure domain:
// fees in bigint minor units. tenant_id NULL = a platform-standard tier (global, NOT creatable via the
// tenant API — Law 11); a tenant tier is owned by its tenant. No version column (add_std_columns) →
// the service serializes mutations with SELECT … FOR UPDATE. benefits is parsed/validated, not trusted.
import { InvalidTierError } from './memberships.errors';
import { BillingCycle } from './memberships.events';

export interface TierBenefits {
  freeDelivery: boolean;
  creditDays: number | null;
  creditLimitMinor: bigint | null;
}
export interface MembershipTierProps {
  id: string; tenantId: string | null; code: string; defaultName: string; audienceRoleId: string | null;
  monthlyFeeMinor: bigint; annualFeeMinor: bigint | null; currencyCode: string;
  platformFeeBpsOverride: number | null; benefits: TierBenefits; isActive: boolean; createdAt: Date;
}
const CODE_RE = /^[a-z0-9_]{2,40}$/;

export function parseBenefits(raw: any): TierBenefits {
  const r = raw ?? {};
  const creditDays = r.creditDays ?? r.credit_days ?? null;
  if (creditDays != null && (!Number.isInteger(creditDays) || creditDays < 0 || creditDays > 365)) throw new InvalidTierError('benefits.creditDays must be 0..365');
  const climRaw = r.creditLimitMinor ?? r.credit_limit_minor ?? null;
  if (climRaw != null && (typeof climRaw !== 'string' || !/^\d{1,16}$/.test(climRaw))) throw new InvalidTierError('benefits.creditLimitMinor must be a non-negative minor string');
  return { freeDelivery: !!(r.freeDelivery ?? r.free_delivery ?? false), creditDays: creditDays ?? null, creditLimitMinor: climRaw != null ? BigInt(climRaw) : null };
}

export class MembershipTier {
  private constructor(private props: MembershipTierProps) {}

  static create(input: { id: string; tenantId: string; code: string; defaultName: string; audienceRoleId?: string | null; monthlyFeeMinor: bigint; annualFeeMinor?: bigint | null; currencyCode?: string; platformFeeBpsOverride?: number | null; benefits: TierBenefits; now?: Date }): MembershipTier {
    const code = (input.code ?? '').trim().toLowerCase();
    if (!CODE_RE.test(code)) throw new InvalidTierError('code must be 2..40 chars of a-z 0-9 _');
    if (!input.defaultName?.trim()) throw new InvalidTierError('name is required');
    if (input.monthlyFeeMinor < 0n) throw new InvalidTierError('monthly fee cannot be negative');
    if (input.annualFeeMinor != null && input.annualFeeMinor < 0n) throw new InvalidTierError('annual fee cannot be negative');
    if (input.platformFeeBpsOverride != null && (!Number.isInteger(input.platformFeeBpsOverride) || input.platformFeeBpsOverride < 0 || input.platformFeeBpsOverride > 10000)) throw new InvalidTierError('platformFeeBpsOverride must be 0..10000');
    return new MembershipTier({ id: input.id, tenantId: input.tenantId, code, defaultName: input.defaultName.trim(), audienceRoleId: input.audienceRoleId ?? null,
      monthlyFeeMinor: input.monthlyFeeMinor, annualFeeMinor: input.annualFeeMinor ?? null, currencyCode: input.currencyCode ?? 'INR',
      platformFeeBpsOverride: input.platformFeeBpsOverride ?? null, benefits: input.benefits, isActive: true, createdAt: input.now ?? new Date() });
  }
  static rehydrate(props: MembershipTierProps): MembershipTier { return new MembershipTier(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get isActive() { return this.props.isActive; }
  get currencyCode() { return this.props.currencyCode; }
  toProps(): Readonly<MembershipTierProps> { return Object.freeze({ ...this.props }); }

  setActive(active: boolean): void { this.props.isActive = active; }

  /** The fee for a billing cycle. Annual must be configured to be offered; monthly always exists (may be 0). */
  feeFor(cycle: BillingCycle): bigint | null {
    if (cycle === 'annual') return this.props.annualFeeMinor;   // null ⇒ annual not offered
    return this.props.monthlyFeeMinor;
  }
}
