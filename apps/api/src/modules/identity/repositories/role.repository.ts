// modules/identity/repositories/role.repository.ts · dynamic RBAC reads + override writes.
// roles/permissions/role_permissions are GLOBAL master data (Law 6). Effective-permission
// RESOLUTION is in core/rbac/role-cache.service (cached); this repo is the CRUD surface.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Role } from '../domain/role.entity';
import { Permission } from '../domain/permission.entity';

@Injectable()
export class RoleRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async findByCode(tenantId: string, code: string): Promise<Role | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, code, default_name, scope, requires_kyc, requires_approval, module_code, is_active
         FROM roles WHERE code=$1 AND deleted_at IS NULL`, [code]);
    const x = r.rows[0];
    return x ? new Role({ id: x.id, code: x.code, defaultName: x.default_name, scope: x.scope, requiresKyc: x.requires_kyc, requiresApproval: x.requires_approval, moduleCode: x.module_code, isActive: x.is_active }) : null;
  }
  async list(tenantId: string, opts: { scope?: string; activeOnly: boolean }): Promise<Role[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, code, default_name, scope, requires_kyc, requires_approval, module_code, is_active
         FROM roles WHERE deleted_at IS NULL AND ($1::text IS NULL OR scope=$1) AND ($2 = false OR is_active) ORDER BY code`,
      [opts.scope ?? null, opts.activeOnly]);
    return r.rows.map((x) => new Role({ id: x.id, code: x.code, defaultName: x.default_name, scope: x.scope, requiresKyc: x.requires_kyc, requiresApproval: x.requires_approval, moduleCode: x.module_code, isActive: x.is_active }));
  }
  async listPermissions(tenantId: string, moduleCode?: string): Promise<Permission[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT code, default_name, module_code FROM permissions WHERE ($1::text IS NULL OR module_code=$1) ORDER BY code`,
      [moduleCode ?? null]);
    return r.rows.map((x) => new Permission({ code: x.code, defaultName: x.default_name, moduleCode: x.module_code }));
  }
  async upsertStaffOverride(tx: TxContext, userTenantRoleId: string, permissionCode: string, isGranted: boolean): Promise<void> {
    await tx.query(
      `INSERT INTO staff_permission_overrides (user_tenant_role_id, permission_code, is_granted)
       VALUES ($1,$2,$3) ON CONFLICT (user_tenant_role_id, permission_code) DO UPDATE SET is_granted=EXCLUDED.is_granted`,
      [userTenantRoleId, permissionCode, isGranted]);
  }
}
