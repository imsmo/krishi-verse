// modules/tenancy/repositories/tenant.repository.ts · SQL for the tenants row as the self-serve plane sees it
// (0002 tenants). The `tenants` table has NO tenant_id column (it IS the tenant) → access is by id, and the
// self-serve service ALWAYS passes the caller's own ctx.tenantId as the id (no cross-tenant read/IDOR). UPDATE
// touches ONLY profile columns — status/slug/tenant_type/country/risk_score are never written here (Law 11).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Tenant } from '../domain/tenant.entity';
import { TenantStatus } from '../domain/tenant.state';

const COLS = `id, slug, legal_name, display_name, tenant_type_id, country_code, region_id, gstin, pan, cin_or_reg_no,
  fssai_license, owner_name, owner_phone, owner_email, status, risk_score, approved_at, created_at`;

function toDomain(r: any): Tenant {
  return Tenant.rehydrate({
    id: r.id, slug: r.slug, legalName: r.legal_name, displayName: r.display_name, tenantTypeId: r.tenant_type_id,
    countryCode: r.country_code, regionId: r.region_id, gstin: r.gstin, pan: r.pan, cinOrRegNo: r.cin_or_reg_no,
    fssaiLicense: r.fssai_license, ownerName: r.owner_name, ownerPhone: r.owner_phone, ownerEmail: r.owner_email,
    status: r.status as TenantStatus, riskScore: r.risk_score, approvedAt: r.approved_at, createdAt: r.created_at,
  });
}

@Injectable()
export class TenantRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async getById(tenantId: string): Promise<Tenant | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM tenants WHERE id=$1`, [tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getForUpdate(tx: TxContext, tenantId: string): Promise<Tenant | null> {
    const r = await tx.query(`SELECT ${COLS} FROM tenants WHERE id=$1 FOR UPDATE`, [tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Profile-only UPDATE — deliberately omits status/slug/tenant_type_id/country_code/risk_score (god-mode). */
  async updateProfile(tx: TxContext, t: Tenant): Promise<void> {
    const p = t.toProps();
    await tx.query(
      `UPDATE tenants SET legal_name=$2, display_name=$3, region_id=$4, gstin=$5, pan=$6, cin_or_reg_no=$7,
         fssai_license=$8, owner_name=$9, owner_phone=$10, owner_email=$11, updated_at=now()
        WHERE id=$1`,
      [p.id, p.legalName, p.displayName, p.regionId, p.gstin, p.pan, p.cinOrRegNo, p.fssaiLicense, p.ownerName, p.ownerPhone, p.ownerEmail]);
  }
}
