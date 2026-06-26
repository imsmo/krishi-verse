// modules/group-lots/repositories/group-lot.repository.ts · all SQL for group_lots + group_lot_pledges.
// tenant_id in EVERY query (Law 1) + RLS. No version column on group_lots → mutations lock FOR UPDATE.
// Reads on the replica; keyset lists. Quantities are numeric(14,3) decimal strings; money bigint minor.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { GroupLot } from '../domain/group-lot.entity';

const COLS = `id, tenant_id, coordinator_user_id, product_id, target_quantity, pledged_quantity, unit_code, pledge_deadline, status, coordination_fee_bps, created_at`;
function toDomain(r: any): GroupLot {
  return GroupLot.rehydrate({
    id: r.id, tenantId: r.tenant_id, coordinatorUserId: r.coordinator_user_id, productId: r.product_id,
    targetQuantity: String(r.target_quantity), pledgedQuantity: String(r.pledged_quantity), unitCode: r.unit_code,
    pledgeDeadline: r.pledge_deadline instanceof Date ? r.pledge_deadline.toISOString() : String(r.pledge_deadline),
    status: r.status, coordinationFeeBps: Number(r.coordination_fee_bps), createdAt: r.created_at,
  });
}

export interface PledgeRow { id: string; groupLotId: string; farmerUserId: string; quantity: string; qualityOk: boolean | null; settledShareMinor: string | null; createdAt?: Date; }

@Injectable()
export class GroupLotRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, g: GroupLot): Promise<void> {
    const p = g.toProps();
    await tx.query(
      `INSERT INTO group_lots (id, tenant_id, coordinator_user_id, product_id, target_quantity, pledged_quantity, unit_code, pledge_deadline, status, coordination_fee_bps, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$3)`,
      [p.id, p.tenantId, p.coordinatorUserId, p.productId, p.targetQuantity, p.pledgedQuantity, p.unitCode, p.pledgeDeadline, p.status, p.coordinationFeeBps]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<GroupLot | null> {
    const r = await tx.query(`SELECT ${COLS} FROM group_lots WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<GroupLot | null> {
    const sql = `SELECT ${COLS} FROM group_lots WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, g: GroupLot): Promise<void> {
    const p = g.toProps();
    await tx.query(`UPDATE group_lots SET pledged_quantity=$3, status=$4, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [p.id, p.tenantId, p.pledgedQuantity, p.status]);
  }
  async listFor(tenantId: string, q: { coordinatorUserId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }): Promise<GroupLot[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.coordinatorUserId) where += ` AND coordinator_user_id=${p(q.coordinatorUserId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM group_lots WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }

  // --- pledges ---
  async insertPledge(tx: TxContext, tenantId: string, row: { id: string; groupLotId: string; farmerUserId: string; quantity: string }): Promise<void> {
    await tx.query(
      `INSERT INTO group_lot_pledges (id, group_lot_id, tenant_id, farmer_user_id, quantity, created_by)
       VALUES ($1,$2,$3,$4,$5,$4)
       ON CONFLICT (group_lot_id, farmer_user_id) DO UPDATE SET quantity = group_lot_pledges.quantity + EXCLUDED.quantity, updated_at = now()`,
      [row.id, row.groupLotId, tenantId, row.farmerUserId, row.quantity]);
  }
  async listPledgesForUpdate(tx: TxContext, tenantId: string, groupLotId: string): Promise<PledgeRow[]> {
    const r = await tx.query(
      `SELECT id, group_lot_id, farmer_user_id, quantity, quality_ok, settled_share_minor, created_at
       FROM group_lot_pledges WHERE group_lot_id=$1 AND tenant_id=$2 AND deleted_at IS NULL ORDER BY id FOR UPDATE`, [groupLotId, tenantId]);
    return r.rows.map((x: any) => ({ id: x.id, groupLotId: x.group_lot_id, farmerUserId: x.farmer_user_id, quantity: String(x.quantity), qualityOk: x.quality_ok, settledShareMinor: x.settled_share_minor != null ? String(x.settled_share_minor) : null, createdAt: x.created_at }));
  }
  async listPledges(tenantId: string, groupLotId: string): Promise<PledgeRow[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT id, group_lot_id, farmer_user_id, quantity, quality_ok, settled_share_minor, created_at
       FROM group_lot_pledges WHERE group_lot_id=$1 AND tenant_id=$2 AND deleted_at IS NULL ORDER BY id`, [groupLotId, tenantId]);
    return r.rows.map((x: any) => ({ id: x.id, groupLotId: x.group_lot_id, farmerUserId: x.farmer_user_id, quantity: String(x.quantity), qualityOk: x.quality_ok, settledShareMinor: x.settled_share_minor != null ? String(x.settled_share_minor) : null, createdAt: x.created_at }));
  }
  async setSettledShare(tx: TxContext, tenantId: string, pledgeId: string, shareMinor: bigint): Promise<void> {
    await tx.query(`UPDATE group_lot_pledges SET settled_share_minor=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2`, [pledgeId, tenantId, shareMinor.toString()]);
  }
}
