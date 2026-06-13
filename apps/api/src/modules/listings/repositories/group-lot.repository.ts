// modules/listings/repositories/group-lot.repository.ts
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { GroupLot, GroupLotProps } from '../domain/group-lot.entity';
import { GroupLotStatus } from '../domain/group-lot.state';
import { ListingConcurrencyError } from '../domain/listing.errors';

interface Row { id:string; tenant_id:string; coordinator_user_id:string; product_id:string;
  target_quantity:string; pledged_quantity:string; unit_code:string; pledge_deadline:Date;
  status:string; coordination_fee_bps:number; version:number; }

@Injectable()
export class GroupLotRepository {
  async insert(tx: TxContext, g: GroupLot): Promise<void> {
    const p = g.toProps();
    await tx.query(
      `INSERT INTO group_lots (id, tenant_id, coordinator_user_id, product_id, target_quantity, pledged_quantity, unit_code, pledge_deadline, status, coordination_fee_bps, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id,p.tenantId,p.coordinatorUserId,p.productId,p.targetQuantity,p.pledgedQuantity,p.unitCode,p.pledgeDeadline,p.status,p.coordinationFeeBps,p.version]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<GroupLot | null> {
    const r = await tx.query<Row>(`SELECT * FROM group_lots WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    if (!r.rows[0]) return null;
    const x = r.rows[0];
    return GroupLot.rehydrate({ id:x.id, tenantId:x.tenant_id, coordinatorUserId:x.coordinator_user_id, productId:x.product_id,
      targetQuantity:Number(x.target_quantity), pledgedQuantity:Number(x.pledged_quantity), unitCode:x.unit_code,
      pledgeDeadline:x.pledge_deadline, status:x.status as GroupLotStatus, coordinationFeeBps:x.coordination_fee_bps, version:x.version } as GroupLotProps);
  }
  async update(tx: TxContext, g: GroupLot): Promise<void> {
    const p = g.toProps();
    const r = await tx.query(
      `UPDATE group_lots SET pledged_quantity=$3, status=$4, version=version+1, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND version=$5`,
      [p.id,p.tenantId,p.pledgedQuantity,p.status,p.version]);
    if (r.rowCount === 0) throw new ListingConcurrencyError(p.id);
  }
}
