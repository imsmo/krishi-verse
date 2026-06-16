// modules/identity/domain/role.entity.ts · read model for a dynamic RBAC role (data, not code).
export interface RoleProps {
  id: string; code: string; defaultName: string; scope: 'tenant' | 'platform';
  requiresKyc: boolean; requiresApproval: boolean; moduleCode: string | null; isActive: boolean;
}
export class Role {
  constructor(readonly props: RoleProps) {}
  get id() { return this.props.id; }
  get code() { return this.props.code; }
  get requiresApproval() { return this.props.requiresApproval; }
  get requiresKyc() { return this.props.requiresKyc; }
  get isPlatform() { return this.props.scope === 'platform'; }
}
