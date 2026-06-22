// modules/tenancy/domain/tenant-domain.entity.ts · a tenant's subdomain / custom domain (0002 tenant_domains).
// Pure TS. A tenant adds a domain (TLS starts 'pending'); verification + TLS issuance are platform/automation
// (markVerified is NOT exposed to the self-serve controller). A domain may become primary only AFTER it is
// verified. Hostnames are normalised (lower-case, trimmed) and validated (anchored, ReDoS-safe). Tenant-scoped.
import { InvalidTenantDomainError } from './tenancy.errors';
import type { DomainEvent } from './tenancy.events';

// labels of 1–63 chars; total ≤255; no leading/trailing hyphen per label (anchored — no catastrophic backtracking)
const HOST_RE = /^(?=.{1,255}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
export const TLS_STATUSES = ['pending', 'provisioning', 'active', 'failed'] as const;
export type TlsStatus = (typeof TLS_STATUSES)[number];

export interface TenantDomainProps {
  id: string; tenantId: string; domain: string; isPrimary: boolean; tlsStatus: TlsStatus; verifiedAt: Date | null; createdAt?: Date | null;
}

export function normalizeDomain(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!HOST_RE.test(v)) throw new InvalidTenantDomainError('domain must be a valid hostname');
  return v;
}

export class TenantDomain {
  private readonly events: DomainEvent[] = [];
  private constructor(private p: TenantDomainProps) {}

  static create(input: { id: string; tenantId: string; domain: string }): TenantDomain {
    const d = new TenantDomain({ id: input.id, tenantId: input.tenantId, domain: normalizeDomain(input.domain), isPrimary: false, tlsStatus: 'pending', verifiedAt: null });
    d.events.push({ type: 'tenancy.tenant_domain_added', payload: { tenantId: input.tenantId, domainId: d.p.id, domain: d.p.domain } });
    return d;
  }
  static rehydrate(p: TenantDomainProps): TenantDomain { return new TenantDomain(p); }

  get id() { return this.p.id; }
  get isPrimary() { return this.p.isPrimary; }
  get isVerified() { return this.p.verifiedAt != null; }
  toProps(): Readonly<TenantDomainProps> { return Object.freeze({ ...this.p }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Platform/automation path — verify the domain + flip TLS active. Not exposed to the tenant self-serve API. */
  markVerified(at: Date): void { this.p.verifiedAt = at; this.p.tlsStatus = 'active'; }

  /** Self-serve: make this the primary domain. Only a VERIFIED domain may be primary (fail closed). */
  makePrimary(): void {
    if (this.p.isPrimary) throw new InvalidTenantDomainError('domain is already primary');
    if (!this.isVerified) throw new InvalidTenantDomainError('only a verified domain can be made primary');
    this.p.isPrimary = true;
    this.events.push({ type: 'tenancy.tenant_domain_primary_changed', payload: { tenantId: this.p.tenantId, domainId: this.p.id } });
  }
  clearPrimary(): void { this.p.isPrimary = false; }   // used when re-pointing primary to another domain
}
