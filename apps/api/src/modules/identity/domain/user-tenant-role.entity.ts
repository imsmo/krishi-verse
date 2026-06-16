// modules/identity/domain/user-tenant-role.entity.ts
// A person's membership of a tenant in a specific role. Approval gating lives here:
// roles flagged requires_approval start INACTIVE and only activate on approve().
import { RoleNotApprovedError } from './identity.errors';
import type { DomainEvent } from './user.entity';
import { KycStatus } from './kyc-document.state';

export interface UserTenantRoleProps {
  id: string;
  userId: string;
  tenantId: string;
  roleId: string;
  roleCode: string;
  kycStatus: KycStatus;
  isActive: boolean;
  roleData: Record<string, unknown>;
  approvedBy: string | null;
  approvedAt: Date | null;
}

export class UserTenantRole {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: UserTenantRoleProps) {}

  static assign(input: { id: string; userId: string; tenantId: string; roleId: string; roleCode: string; requiresApproval: boolean; roleData?: Record<string, unknown> }): UserTenantRole {
    const utr = new UserTenantRole({
      id: input.id, userId: input.userId, tenantId: input.tenantId, roleId: input.roleId, roleCode: input.roleCode,
      kycStatus: 'none', isActive: !input.requiresApproval, roleData: input.roleData ?? {},
      approvedBy: null, approvedAt: null,
    });
    utr.events.push({ type: 'identity.role_assigned', payload: { userId: input.userId, tenantId: input.tenantId, roleCode: input.roleCode, active: utr.props.isActive } });
    return utr;
  }
  static rehydrate(props: UserTenantRoleProps): UserTenantRole { return new UserTenantRole(props); }

  get id() { return this.props.id; }
  get isActive() { return this.props.isActive; }
  get roleCode() { return this.props.roleCode; }
  toProps(): Readonly<UserTenantRoleProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  approve(approverUserId: string, now: Date = new Date()): void {
    this.props.isActive = true;
    this.props.approvedBy = approverUserId;
    this.props.approvedAt = now;
    this.events.push({ type: 'identity.role_approved', payload: { id: this.props.id, userId: this.props.userId, tenantId: this.props.tenantId, roleCode: this.props.roleCode, approvedBy: approverUserId } });
  }
  revoke(by?: string): void {
    this.props.isActive = false;
    this.events.push({ type: 'identity.role_revoked', payload: { id: this.props.id, userId: this.props.userId, tenantId: this.props.tenantId, roleCode: this.props.roleCode, by } });
  }
  setKycStatus(s: KycStatus): void { this.props.kycStatus = s; }
  assertActive(): void { if (!this.props.isActive) throw new RoleNotApprovedError(); }
}
