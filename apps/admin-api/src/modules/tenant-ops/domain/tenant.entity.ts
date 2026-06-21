// apps/admin-api/src/modules/tenant-ops/domain/tenant.entity.ts · the tenant lifecycle entity as the god-mode
// plane sees it (subset of the tenants row relevant to ops). Pure domain, no I/O. Lifecycle moves go ONLY
// through tenant.state.ts (Law 5); each method returns {from,to} for the audit + status-event rows. The three
// god-mode actions are explicit (approve / suspend / archive) so the controller surface maps 1:1 and the legal
// source states are encoded here, not in SQL.
import { TenantStatus, assertTransition } from './tenant.state';
import { InvalidTenantOpError } from './tenant-ops.errors';

export interface TenantProps {
  id: string;
  slug: string;
  status: TenantStatus;
  riskScore: number;
  approvedAt: Date | null;
  createdAt?: Date | null;     // for keyset cursors (list/search)
}

export class Tenant {
  private constructor(private props: TenantProps) {}
  static rehydrate(p: TenantProps): Tenant { return new Tenant(p); }

  get id() { return this.props.id; }
  get slug() { return this.props.slug; }
  get status() { return this.props.status; }
  get approvedAt() { return this.props.approvedAt; }

  private move(to: TenantStatus): { from: TenantStatus; to: TenantStatus } {
    const from = this.props.status;
    assertTransition(from, to);            // throws IllegalTenantTransitionError on an illegal move
    this.props.status = to;
    return { from, to };
  }

  /** Approve onboarding: only a pending/trial tenant can be approved into active. Stamps approved_at. */
  approve(): { from: TenantStatus; to: TenantStatus; approvedAt: Date } {
    if (this.props.status !== 'pending' && this.props.status !== 'trial') {
      throw new InvalidTenantOpError(`only a pending/trial tenant can be approved (was ${this.props.status})`);
    }
    const change = this.move('active');
    const approvedAt = new Date();
    this.props.approvedAt = approvedAt;
    return { ...change, approvedAt };
  }

  /** Suspend a live tenant (active/trial/grace) — billing failure, abuse, compliance hold. */
  suspend(): { from: TenantStatus; to: TenantStatus } {
    return this.move('suspended');
  }

  /** Archive a tenant (offboarding). Allowed from any non-terminal state per the state machine. */
  archive(): { from: TenantStatus; to: TenantStatus } {
    return this.move('archived');
  }

  toJSON() {
    const v = this.props;
    return { id: v.id, slug: v.slug, status: v.status, riskScore: v.riskScore, approvedAt: v.approvedAt, createdAt: v.createdAt ?? null };
  }
}
