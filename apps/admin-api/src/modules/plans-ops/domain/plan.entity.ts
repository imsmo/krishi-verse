// apps/admin-api/src/modules/plans-ops/domain/plan.entity.ts · the SaaS-plan aggregate (pure, no I/O). Prices are
// bigint MINOR UNITS (Law 2 — never float). It is the only place plan invariants + lifecycle are enforced: a
// DRAFT plan is freely editable; once PUBLISHED its prices are IMMUTABLE (grandfathering — existing subscriptions
// keep their version) and a price change must create a NEW version. Lifecycle goes only through the state machine.
import { PlanStatus, assertTransition, isActiveStatus } from './plan.state';
import { InvalidPlanError, PlanImmutableError } from './plans-ops.errors';

const CODE_RE = /^[a-z0-9_]{2,40}$/;       // linear, ReDoS-safe
const LIMIT_RE = /^[a-z0-9_]{2,60}$/;
const FEATURE_RE = /^[a-z0-9_]{2,60}$/;

export function assertPlanCode(code: string): string { if (!CODE_RE.test(code)) throw new InvalidPlanError('code must be 2..40 chars of a-z 0-9 _'); return code; }
export function assertCountry(cc: string): string { if (!/^[A-Z]{2}$/.test(cc)) throw new InvalidPlanError('countryCode must be ISO-3166 alpha-2'); return cc; }
export function assertCurrency(cur: string): string { if (!/^[A-Z]{3}$/.test(cur)) throw new InvalidPlanError('currencyCode must be ISO-4217'); return cur; }
export function assertLimitCode(code: string): string { if (!LIMIT_RE.test(code)) throw new InvalidPlanError(`bad limit code: ${code}`); return code; }
export function assertFeatureCode(code: string): string { if (!FEATURE_RE.test(code)) throw new InvalidPlanError(`bad feature code: ${code}`); return code; }
export function assertLimitValue(v: bigint): bigint { if (v < -1n) throw new InvalidPlanError('limit must be >= -1 (-1 = unlimited)'); return v; }
export function assertPrices(monthly: bigint, annual: bigint, setup: bigint): void {
  for (const v of [monthly, annual, setup]) if (v < 0n) throw new InvalidPlanError('prices cannot be negative (minor units)');
}

export interface PlanProps {
  id: string; code: string; version: number; defaultName: string; countryCode: string; currencyCode: string;
  monthlyPriceMinor: bigint; annualPriceMinor: bigint; setupFeeMinor: bigint;
  isPublic: boolean; isActive: boolean; status: PlanStatus; createdAt?: Date | null;
}
export interface PlanChange { action: string; oldValue: Record<string, unknown>; newValue: Record<string, unknown>; }

export class Plan {
  private constructor(private p: PlanProps) {}
  static rehydrate(p: PlanProps): Plan { return new Plan(p); }

  /** Build a NEW DRAFT plan (version defaults to 1). Validates all invariants. */
  static createDraft(input: { id: string; code: string; version?: number; defaultName: string; countryCode: string; currencyCode: string; monthlyPriceMinor: bigint; annualPriceMinor: bigint; setupFeeMinor?: bigint; isPublic?: boolean }): Plan {
    const code = assertPlanCode((input.code ?? '').trim().toLowerCase());
    if (!input.defaultName?.trim()) throw new InvalidPlanError('name is required');
    assertCountry(input.countryCode); assertCurrency(input.currencyCode);
    const setup = input.setupFeeMinor ?? 0n;
    assertPrices(input.monthlyPriceMinor, input.annualPriceMinor, setup);
    return new Plan({ id: input.id, code, version: input.version ?? 1, defaultName: input.defaultName.trim(), countryCode: input.countryCode, currencyCode: input.currencyCode,
      monthlyPriceMinor: input.monthlyPriceMinor, annualPriceMinor: input.annualPriceMinor, setupFeeMinor: setup,
      isPublic: input.isPublic ?? true, isActive: false, status: 'draft', createdAt: null });
  }

  get id(): string { return this.p.id; }
  get code(): string { return this.p.code; }
  get version(): number { return this.p.version; }
  get countryCode(): string { return this.p.countryCode; }
  get status(): PlanStatus { return this.p.status; }

  private to(next: PlanStatus): PlanChange {
    const from = this.p.status;
    assertTransition(from, next);                          // throws IllegalPlanTransitionError
    this.p.status = next;
    this.p.isActive = isActiveStatus(next);                // keep the runtime sellability flag in sync
    return { action: next === 'active' ? (from === 'archived' ? 'reactivated' : 'published') : 'archived', oldValue: { status: from }, newValue: { status: next } };
  }
  publish(): PlanChange { return this.to('active'); }
  archive(): PlanChange { return this.to('archived'); }
  reactivate(): PlanChange { return this.to('active'); }

  /** Edit prices — ONLY while draft. A published plan is immutable (version it instead). */
  setPrices(monthlyPriceMinor: bigint, annualPriceMinor: bigint, setupFeeMinor: bigint): PlanChange {
    if (this.p.status !== 'draft') throw new PlanImmutableError('prices of a published/archived plan are immutable; create a new version');
    assertPrices(monthlyPriceMinor, annualPriceMinor, setupFeeMinor);
    const old = { monthlyPriceMinor: this.p.monthlyPriceMinor.toString(), annualPriceMinor: this.p.annualPriceMinor.toString(), setupFeeMinor: this.p.setupFeeMinor.toString() };
    this.p.monthlyPriceMinor = monthlyPriceMinor; this.p.annualPriceMinor = annualPriceMinor; this.p.setupFeeMinor = setupFeeMinor;
    return { action: 'price_changed', oldValue: old, newValue: { monthlyPriceMinor: monthlyPriceMinor.toString(), annualPriceMinor: annualPriceMinor.toString(), setupFeeMinor: setupFeeMinor.toString() } };
  }

  /** Visibility (public vs custom/anchor) is not grandfathered — editable at any status. */
  setVisibility(isPublic: boolean): PlanChange {
    const old = this.p.isPublic; this.p.isPublic = isPublic;
    return { action: 'visibility_changed', oldValue: { isPublic: old }, newValue: { isPublic } };
  }

  toProps(): Readonly<PlanProps> { return Object.freeze({ ...this.p }); }
  toJSON() {
    return { id: this.p.id, code: this.p.code, version: this.p.version, defaultName: this.p.defaultName, countryCode: this.p.countryCode, currency: this.p.currencyCode,
      monthlyPriceMinor: this.p.monthlyPriceMinor.toString(), annualPriceMinor: this.p.annualPriceMinor.toString(), setupFeeMinor: this.p.setupFeeMinor.toString(),
      isPublic: this.p.isPublic, isActive: this.p.isActive, status: this.p.status, createdAt: this.p.createdAt ?? null };
  }
}
