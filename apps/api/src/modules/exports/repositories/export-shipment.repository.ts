// modules/exports/repositories/export-shipment.repository.ts · all SQL for export_shipments. tenant_id in
// EVERY query (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { ExportShipment } from '../domain/export-shipment.entity';
import { ShipmentStatus } from '../domain/export-shipment.state';

const COLS = `id, tenant_id, exporter_user_id, destination_country, incoterm, status, order_ids, vessel_or_awb, lc_ref, total_value_minor, currency_code, created_at`;
function toDomain(r: any): ExportShipment {
  return ExportShipment.rehydrate({ id: r.id, tenantId: r.tenant_id, exporterUserId: r.exporter_user_id, destinationCountry: r.destination_country, incoterm: r.incoterm, status: r.status as ShipmentStatus,
    orderIds: r.order_ids ?? [], vesselOrAwb: r.vessel_or_awb, lcRef: r.lc_ref, totalValueMinor: r.total_value_minor != null ? BigInt(r.total_value_minor) : null, currencyCode: r.currency_code, createdAt: r.created_at });
}
@Injectable()
export class ExportShipmentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, s: ExportShipment): Promise<void> {
    const p = s.toProps();
    await tx.query(`INSERT INTO export_shipments (id, tenant_id, exporter_user_id, destination_country, incoterm, status, order_ids, vessel_or_awb, lc_ref, total_value_minor, currency_code, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$3)`,
      [p.id, p.tenantId, p.exporterUserId, p.destinationCountry, p.incoterm, p.status, JSON.stringify(p.orderIds), p.vesselOrAwb, p.lcRef, p.totalValueMinor?.toString() ?? null, p.currencyCode]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<ExportShipment | null> {
    const r = await tx.query(`SELECT ${COLS} FROM export_shipments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<ExportShipment | null> {
    const sql = `SELECT ${COLS} FROM export_shipments WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, s: ExportShipment): Promise<void> {
    const p = s.toProps();
    await tx.query(`UPDATE export_shipments SET status=$3, vessel_or_awb=$4, lc_ref=$5, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.status, p.vesselOrAwb, p.lcRef]);
  }
  async listFor(tenantId: string, q: { exporterUserId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }): Promise<ExportShipment[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.exporterUserId) where += ` AND exporter_user_id=${p(q.exporterUserId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM export_shipments WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
