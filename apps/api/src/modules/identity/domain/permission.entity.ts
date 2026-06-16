// modules/identity/domain/permission.entity.ts · read model for an atomic permission.
export interface PermissionProps { code: string; defaultName: string; moduleCode: string | null; }
export class Permission { constructor(readonly props: PermissionProps) {} get code() { return this.props.code; } }
