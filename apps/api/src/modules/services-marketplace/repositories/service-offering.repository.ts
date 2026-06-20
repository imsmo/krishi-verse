// modules/services-marketplace/repositories/service-offering.repository.ts · all SQL for service_offerings.
// tenant_id in EVERY query (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ServiceOffering } from '../domain/service-offering.entity';
import { PricingModel, OfferingStatus } from '../domain/services-marketplace.events';

const COLS = `id, tenant_id, provider_user_id, category_id, default_title, description, pricing_model, price_minor, currency_code, capacity_per_slot, service_radius_km, address_id, status, created_at`;
function toDomain(r: any): ServiceOffering {
  return ServiceOffering.rehydrate({ id: r.id, tenantId: r.tenant_id, providerUserId: r.provider_user_id, categoryId: r.category_id, defaultTitle: r.default_title, description: r.description,
    pricingModel: r.pricing_model as PricingModel, priceMinor: BigInt(r.price_minor), currencyCode: r.currency_code, capacityPerSlot: r.capacity_per_slot, serviceRadiusKm: r.service_radius_km, addressId: r.address_id, status: r.status as OfferingStatus, createdAt: r.created_at });
}
export interface OfferingListQuery { providerUserId?: string; browse?: boolean; categoryId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ServiceOfferingRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, o: ServiceOffering): Promise<void> {
    const p = o.toProps();
    await tx.query(
      `INSERT INTO service_offerings (id, tenant_id, provider_user_id, category_id, default_title, description, pricing_model, price_minor, currency_code, capacity_per_slot, service_radius_km, address_id, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$3)`,
      [p.id, p.tenantId, p.providerUserId, p.categoryId, p.defaultTitle, p.description, p.pricingModel, p.priceMinor.toString(), p.currencyCode, p.capacityPerSlot, p.serviceRadiusKm, p.addressId, p.status]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ServiceOffering | null> {
    const r = await tx.query(`SELECT ${COLS} FROM service_offerings WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<ServiceOffering | null> {
    const sql = `SELECT ${COLS} FROM service_offerings WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, o: ServiceOffering): Promise<void> {
    const p = o.toProps();
    await tx.query(`UPDATE service_offerings SET default_title=$3, description=$4, price_minor=$5, capacity_per_slot=$6, service_radius_km=$7, address_id=$8, status=$9, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.defaultTitle, p.description, p.priceMinor.toString(), p.capacityPerSlot, p.serviceRadiusKm, p.addressId, p.status]);
  }
  async listFor(tenantId: string, q: OfferingListQuery): Promise<ServiceOffering[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.providerUserId) where += ` AND provider_user_id=${p(q.providerUserId)}`;
    if (q.browse) where += ` AND status='published'`;
    if (q.categoryId) where += ` AND category_id=${p(q.categoryId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM service_offerings WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
