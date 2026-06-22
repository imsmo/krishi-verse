// modules/tenancy/domain/tenant.entity.ts · a tenant as the IN-TENANT self-serve plane sees it (0002 tenants).
// Pure TS. A tenant admin may edit ONLY its own PROFILE fields here; identity (slug), classification
// (tenant_type_id, country_code), and lifecycle (status, risk_score, approved_at, onboarded_by) are god-mode and
// NEVER mutated in apps/api (Law 11 — those live in apps/admin-api tenant-ops). Provisioning (row creation) is also
// god-mode/onboarding — this entity only rehydrates an existing tenant. No money.
import { InvalidTenantProfileError, TenantNotPendingError } from './tenancy.errors';
import { TenantStatus } from './tenant.state';
import { isPending } from './tenant.state';
import type { DomainEvent } from './tenancy.events';

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const PHONE_RE = /^\+?[0-9]{6,15}$/;                                   // light E.164-ish (anchored, ReDoS-safe)
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;          // 15-char GSTIN
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;                               // 10-char PAN

export interface TenantProps {
  id: string; slug: string; legalName: string; displayName: string; tenantTypeId: string; countryCode: string;
  regionId: string | null; gstin: string | null; pan: string | null; cinOrRegNo: string | null; fssaiLicense: string | null;
  ownerName: string | null; ownerPhone: string | null; ownerEmail: string | null;
  status: TenantStatus; riskScore: number; approvedAt?: Date | null; createdAt?: Date | null;
}
/** ONLY these profile fields are self-serve editable. (status/slug/type/country/risk are deliberately absent.) */
export type TenantProfilePatch = {
  legalName?: string; displayName?: string; regionId?: string | null; gstin?: string | null; pan?: string | null;
  cinOrRegNo?: string | null; fssaiLicense?: string | null; ownerName?: string | null; ownerPhone?: string | null; ownerEmail?: string | null;
};

function plain(v: string, max: number, label: string): string {
  const s = v.trim();
  if (!s) throw new InvalidTenantProfileError(`${label} is required`);
  if (s.length > max) throw new InvalidTenantProfileError(`${label} exceeds ${max} chars`);
  if (/[<>]/.test(s) || CONTROL_RE.test(s)) throw new InvalidTenantProfileError(`${label} must be plain text`);
  return s;
}
function optUpper(v: string | null, re: RegExp, label: string): string | null {
  if (v === null) return null;
  const s = v.trim().toUpperCase();
  if (!re.test(s)) throw new InvalidTenantProfileError(`${label} is malformed`);
  return s;
}
function optPhone(v: string | null): string | null { if (v === null) return null; const s = v.trim(); if (!PHONE_RE.test(s)) throw new InvalidTenantProfileError('owner_phone is malformed'); return s; }
function optEmail(v: string | null): string | null { if (v === null) return null; const s = v.trim().toLowerCase(); if (!EMAIL_RE.test(s)) throw new InvalidTenantProfileError('owner_email is malformed'); return s; }
function optName(v: string | null, max: number, label: string): string | null { if (v === null) return null; return plain(v, max, label); }

export class Tenant {
  private readonly events: DomainEvent[] = [];
  private constructor(private p: TenantProps) {}
  static rehydrate(p: TenantProps): Tenant { return new Tenant(p); }

  get id() { return this.p.id; }
  get status() { return this.p.status; }
  toProps(): Readonly<TenantProps> { return Object.freeze({ ...this.p }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Edit self-serve profile fields only. Returns the {old,new} diff for the audit row. Throws if no real change. */
  updateProfile(patch: TenantProfilePatch): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    const set = (k: keyof TenantProps, v: unknown) => { if (v !== (this.p as any)[k]) { old[k] = (this.p as any)[k]; next[k] = v; (this.p as any)[k] = v; } };
    if (patch.legalName !== undefined) set('legalName', plain(patch.legalName, 250, 'legal_name'));
    if (patch.displayName !== undefined) set('displayName', plain(patch.displayName, 150, 'display_name'));
    if (patch.regionId !== undefined) set('regionId', patch.regionId);
    if (patch.gstin !== undefined) set('gstin', optUpper(patch.gstin, GSTIN_RE, 'gstin'));
    if (patch.pan !== undefined) set('pan', optUpper(patch.pan, PAN_RE, 'pan'));
    if (patch.cinOrRegNo !== undefined) set('cinOrRegNo', optName(patch.cinOrRegNo, 40, 'cin_or_reg_no'));
    if (patch.fssaiLicense !== undefined) set('fssaiLicense', optName(patch.fssaiLicense, 20, 'fssai_license'));
    if (patch.ownerName !== undefined) set('ownerName', optName(patch.ownerName, 200, 'owner_name'));
    if (patch.ownerPhone !== undefined) set('ownerPhone', optPhone(patch.ownerPhone));
    if (patch.ownerEmail !== undefined) set('ownerEmail', optEmail(patch.ownerEmail));
    if (Object.keys(next).length === 0) throw new InvalidTenantProfileError('no profile changes supplied');
    this.events.push({ type: 'tenancy.tenant_profile_updated', payload: { tenantId: this.p.id, fields: Object.keys(next) } });
    return { old, new: next };
  }

  /** Submit the onboarding profile for god-mode review. Does NOT change status (Law 11) — only signals admin-api. */
  submitForReview(): void {
    if (!isPending(this.p.status)) throw new TenantNotPendingError(this.p.status);
    this.events.push({ type: 'tenancy.tenant_onboarding_submitted', payload: { tenantId: this.p.id, slug: this.p.slug } });
  }
}
