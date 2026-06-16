// modules/identity/repositories/address.repository.ts · user/tenant address book.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Address, AddressProps } from '../domain/address.entity';

const COLS = `id, user_id, tenant_id, label_id, line1, line2, village, region_id, pincode, country_code, lat, lng, contact_name, contact_phone, is_default`;
const toDomain = (r: any): Address => Address.rehydrate({ id: r.id, userId: r.user_id, tenantId: r.tenant_id, labelId: r.label_id, line1: r.line1, line2: r.line2, village: r.village, regionId: r.region_id, pincode: r.pincode, countryCode: r.country_code, lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null, contactName: r.contact_name, contactPhone: r.contact_phone, isDefault: r.is_default });

@Injectable()
export class AddressRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, a: Address): Promise<void> {
    const p: AddressProps = a.toProps();
    await tx.query(
      `INSERT INTO addresses (${COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [p.id, p.userId, p.tenantId, p.labelId, p.line1, p.line2, p.village, p.regionId, p.pincode, p.countryCode, p.lat, p.lng, p.contactName, p.contactPhone, p.isDefault]);
  }
  async update(tx: TxContext, a: Address): Promise<void> {
    const p = a.toProps();
    await tx.query(
      `UPDATE addresses SET label_id=$2, line1=$3, line2=$4, village=$5, region_id=$6, pincode=$7, lat=$8, lng=$9, contact_name=$10, contact_phone=$11, is_default=$12, updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL`,
      [p.id, p.labelId, p.line1, p.line2, p.village, p.regionId, p.pincode, p.lat, p.lng, p.contactName, p.contactPhone, p.isDefault]);
  }
  async getForUpdate(tx: TxContext, id: string, userId: string): Promise<Address | null> {
    const r = await tx.query(`SELECT ${COLS} FROM addresses WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, userId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async unsetDefaults(tx: TxContext, userId: string): Promise<void> {
    await tx.query(`UPDATE addresses SET is_default=false WHERE user_id=$1 AND is_default AND deleted_at IS NULL`, [userId]);
  }
  async listByUser(tenantId: string, userId: string): Promise<Address[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM addresses WHERE user_id=$1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC`, [userId]);
    return r.rows.map(toDomain);
  }
  async softDelete(tx: TxContext, id: string, userId: string): Promise<void> {
    await tx.query(`UPDATE addresses SET deleted_at=now() WHERE id=$1 AND user_id=$2`, [id, userId]);
  }
}
