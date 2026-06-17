// modules/orders/jobs/abandoned-carts.job.ts · worker job: mark stale active carts abandoned
// (housekeeping + re-engagement signal). Bounded UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
@Injectable()
export class AbandonedCartsJob {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}
  async runForTenant(tenantId: string, idleDays = 7): Promise<number> {
    return this.uow.run(tenantId, async (tx) => {
      const r = await tx.query(
        `UPDATE carts SET status='abandoned' WHERE tenant_id=$1 AND status='active' AND updated_at < now() - ($2 || ' days')::interval`,
        [tenantId, idleDays]);
      return r.rowCount;
    });
  }
}
