// modules/identity/repositories/user-tenant-role.repository.ts
// person × tenant × role. HAS tenant_id ⇒ RLS applies (every query also binds tenant_id
// at the app layer — Law 1). Concurrency via SELECT … FOR UPDATE (no version column here).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { UserTenantRole } from '../domain/user-tenant-role.entity';
import { KycStatus } from '../domain/kyc-document.state';

const COLS = `id, user_id, tenant_id, role_id, kyc_status, is_active, role_data, approved_by, approved_at`;
interface Row { id: string; user_id: string; tenant_id: string; role_id: string; kyc_status: string; is_active: boolean; role_data: any; approved_by: string | null; approved_at: Date | null; }
function toDomain(r: Row, roleCode = ''): UserTenantRole {
  return UserTenantRole.rehydrate({ id: r.id, userId: r.user_id, tenantId: r.tenant_id, roleId: r.role_id, roleCode,
    kycStatus: r.kyc_status as KycStatus, isActive: r.is_active, roleData: r.role_data ?? {}, approvedBy: r.approved_by, approvedAt: r.approved_at });
}

@Injectable()
export class UserTenantRoleRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, utr: UserTenantRole): Promise<void> {
    const p = utr.toProps();
    await tx.query(
      `INSERT INTO user_tenant_roles (id, user_id, tenant_id, role_id, kyc_status, is_active, role_data, approved_by, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
      [p.id, p.userId, p.tenantId, p.roleId, p.kycStatus, p.isActive, JSON.stringify(p.roleData), p.approvedBy, p.approvedAt]);
  }
  async update(tx: TxContext, utr: UserTenantRole): Promise<void> {
    const p = utr.toProps();
    await tx.query(
      `UPDATE user_tenant_roles SET kyc_status=$3, is_active=$4, role_data=$5::jsonb, approved_by=$6, approved_at=$7, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.kycStatus, p.isActive, JSON.stringify(p.roleData), p.approvedBy, p.approvedAt]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<UserTenantRole | null> {
    const r = await tx.query<Row>(`SELECT ${COLS} FROM user_tenant_roles WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async findExisting(tenantId: string, userId: string, roleId: string): Promise<UserTenantRole | null> {
    const r = await this.replica.forTenant(tenantId).query<Row>(
      `SELECT ${COLS} FROM user_tenant_roles WHERE tenant_id=$1 AND user_id=$2 AND role_id=$3 AND deleted_at IS NULL`, [tenantId, userId, roleId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async list(tenantId: string, opts: { userId?: string; roleCode?: string; pendingOnly: boolean }): Promise<any[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT utr.id, utr.user_id, utr.role_id, r.code AS role_code, utr.kyc_status, utr.is_active, utr.approved_at
         FROM user_tenant_roles utr JOIN roles r ON r.id = utr.role_id
        WHERE utr.tenant_id=$1 AND utr.deleted_at IS NULL
          AND ($2::uuid IS NULL OR utr.user_id=$2)
          AND ($3::text IS NULL OR r.code=$3)
          AND ($4 = false OR utr.is_active = false)
        ORDER BY utr.created_at DESC LIMIT 200`,
      [tenantId, opts.userId ?? null, opts.roleCode ?? null, opts.pendingOnly]);
    return r.rows;
  }
  async isMember(tenantId: string, userId: string): Promise<boolean> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT 1 FROM user_tenant_roles WHERE tenant_id=$1 AND user_id=$2 AND is_active AND deleted_at IS NULL LIMIT 1`,
      [tenantId, userId]);
    return r.rowCount! > 0;
  }
  async setKycStatus(tx: TxContext, tenantId: string, userId: string, roleId: string | null, status: KycStatus): Promise<void> {
    await tx.query(
      `UPDATE user_tenant_roles SET kyc_status=$4, updated_at=now()
       WHERE tenant_id=$1 AND user_id=$2 AND ($3::uuid IS NULL OR role_id=$3) AND deleted_at IS NULL`,
      [tenantId, userId, roleId, status]);
  }
}
