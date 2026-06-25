// modules/logistics/repositories/delivery-zone.repository.ts · SQL for delivery_zones (0007). NOT partitioned.
// Tenant-scoped (tenant_id NOT NULL) + RLS. No version col → mutations lock the row. Reads on the replica; keyset
// on (created_at, id). pincodes/region_ids are jsonb arrays (stringified + ::jsonb on write). Serviceability uses
// jsonb containment (pincodes @> ["<pin>"]). A bad charge_definition_id FK surfaces as a typed 422.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { DeliveryZone } from '../domain/delivery-zone.entity';
import { UnknownZoneRouteReferenceError } from '../domain/logistics.errors';

const COLS = `id, tenant_id, default_name, pincodes, region_ids, charge_definition_id, is_active, created_at`;
const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);

function toDomain(r: any): DeliveryZone {
  return DeliveryZone.rehydrate({
    id: r.id, tenantId: r.tenant_id, defaultName: r.default_name, pincodes: arr(r.pincodes), regionIds: arr(r.region_ids),
    chargeDefinitionId: r.charge_definition_id, isActive: r.is_active, createdAt: r.created_at,
  });
}
export interface ZoneListQuery { pincode?: string; activeOnly: boolean; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class DeliveryZoneRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, z: DeliveryZone): Promise<void> {
    const p = z.toProps();
    try {
      await tx.query(
        `INSERT INTO delivery_zones (id, tenant_id, default_name, pincodes, region_ids, charge_definition_id, is_active, created_at)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7, now())`,
        [p.id, p.tenantId, p.defaultName, JSON.stringify(p.pincodes), JSON.stringify(p.regionIds), p.chargeDefinitionId, p.isActive]);
    } catch (e: any) { if (e?.code === '23503') throw new UnknownZoneRouteReferenceError('charge_definition'); throw e; }
  }

  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<DeliveryZone | null> {
    const r = await tx.query(`SELECT ${COLS} FROM delivery_zones WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<DeliveryZone | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM delivery_zones WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }

  async update(tx: TxContext, z: DeliveryZone): Promise<void> {
    const p = z.toProps();
    try {
      await tx.query(
        `UPDATE delivery_zones SET default_name=$3, pincodes=$4::jsonb, region_ids=$5::jsonb, charge_definition_id=$6, is_active=$7, updated_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [p.id, p.tenantId, p.defaultName, JSON.stringify(p.pincodes), JSON.stringify(p.regionIds), p.chargeDefinitionId, p.isActive]);
    } catch (e: any) { if (e?.code === '23503') throw new UnknownZoneRouteReferenceError('charge_definition'); throw e; }
  }

  /** Buyer-facing serviceability read: active zones whose pincodes contain the destination pin OR whose
   *  region_ids contain the destination region. Tenant-scoped + RLS; capped. Used by the checkout
   *  delivery-methods lookup so a buyer sees their delivery options before paying. */
  async listServiceable(tenantId: string, q: { pincode?: string; regionId?: string; limit: number }): Promise<DeliveryZone[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const ors: string[] = [];
    if (q.pincode) ors.push(`pincodes @> ${p(JSON.stringify([q.pincode]))}::jsonb`);
    if (q.regionId) ors.push(`region_ids @> ${p(JSON.stringify([q.regionId]))}::jsonb`);
    if (ors.length === 0) return []; // no destination → nothing to resolve (never list every zone)
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM delivery_zones
        WHERE tenant_id=$1 AND is_active = true AND (${ors.join(' OR ')})
        ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  async list(tenantId: string, q: ZoneListQuery): Promise<DeliveryZone[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `tenant_id=$1`;
    if (q.pincode) where += ` AND pincodes @> ${p(JSON.stringify([q.pincode]))}::jsonb`;
    if (q.activeOnly) where += ` AND is_active = true`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM delivery_zones WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
