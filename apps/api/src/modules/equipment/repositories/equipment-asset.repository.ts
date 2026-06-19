// modules/equipment/repositories/equipment-asset.repository.ts · all SQL for equipment_assets. tenant_id in
// EVERY query (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Reads on replica; keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { EquipmentAsset } from '../domain/equipment-asset.entity';
import { AssetStatus } from '../domain/equipment.events';

const COLS = `id, tenant_id, owner_user_id, category_id, product_id, reg_no, year_of_mfg, engine_hours, hp_rating, base_address_id, service_radius_km, gps_device_ref, status, created_at`;
function toDomain(r: any): EquipmentAsset {
  return EquipmentAsset.rehydrate({ id: r.id, tenantId: r.tenant_id, ownerUserId: r.owner_user_id, categoryId: r.category_id, productId: r.product_id,
    regNo: r.reg_no, yearOfMfg: r.year_of_mfg, engineHours: r.engine_hours != null ? String(r.engine_hours) : null, hpRating: r.hp_rating,
    baseAddressId: r.base_address_id, serviceRadiusKm: r.service_radius_km, gpsDeviceRef: r.gps_device_ref, status: r.status as AssetStatus, createdAt: r.created_at });
}
export interface AssetListQuery { ownerUserId?: string; categoryId?: string; status?: string; activeOnly?: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class EquipmentAssetRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, a: EquipmentAsset): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `INSERT INTO equipment_assets (id, tenant_id, owner_user_id, category_id, product_id, reg_no, year_of_mfg, engine_hours, hp_rating, base_address_id, service_radius_km, gps_device_ref, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$3)`,
      [p.id, p.tenantId, p.ownerUserId, p.categoryId, p.productId, p.regNo, p.yearOfMfg, p.engineHours, p.hpRating, p.baseAddressId, p.serviceRadiusKm, p.gpsDeviceRef, p.status]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<EquipmentAsset | null> {
    const r = await tx.query(`SELECT ${COLS} FROM equipment_assets WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<EquipmentAsset | null> {
    const sql = `SELECT ${COLS} FROM equipment_assets WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, a: EquipmentAsset): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `UPDATE equipment_assets SET product_id=$3, reg_no=$4, year_of_mfg=$5, engine_hours=$6, hp_rating=$7, base_address_id=$8, service_radius_km=$9, gps_device_ref=$10, status=$11, updated_at=now(), updated_by=$12
       WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.productId, p.regNo, p.yearOfMfg, p.engineHours, p.hpRating, p.baseAddressId, p.serviceRadiusKm, p.gpsDeviceRef, p.status, p.ownerUserId]);
  }
  async listFor(tenantId: string, q: AssetListQuery): Promise<EquipmentAsset[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.ownerUserId) where += ` AND owner_user_id=${p(q.ownerUserId)}`;
    if (q.categoryId) where += ` AND category_id=${p(q.categoryId)}`;
    if (q.activeOnly) where += ` AND status='active'`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM equipment_assets WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
