// modules/listings/repositories/group-lot-pledge.repository.ts
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { GroupLotPledge } from '../domain/group-lot-pledge.entity';

@Injectable()
export class GroupLotPledgeRepository {
  async upsert(tx: TxContext, p: GroupLotPledge): Promise<void> {
    const x = p.props;
    await tx.query(
      `INSERT INTO group_lot_pledges (id, group_lot_id, tenant_id, farmer_user_id, quantity)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (group_lot_id, farmer_user_id) DO UPDATE SET quantity = group_lot_pledges.quantity + EXCLUDED.quantity`,
      [x.id, x.groupLotId, x.tenantId, x.farmerUserId, x.quantity]);
  }
  async listByLot(tx: TxContext, tenantId: string, groupLotId: string) {
    const r = await tx.query(`SELECT id, farmer_user_id, quantity FROM group_lot_pledges WHERE tenant_id=$1 AND group_lot_id=$2`, [tenantId, groupLotId]);
    return r.rows;
  }
}
