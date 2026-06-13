// modules/listings/services/group-lot-pledge.service.ts · pledge queries + settlement share calc.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { GroupLotPledgeRepository } from '../repositories/group-lot-pledge.repository';

@Injectable()
export class GroupLotPledgeService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly pledges: GroupLotPledgeRepository,
  ) {}
  async listByLot(tenantId: string, groupLotId: string) {
    return this.uow.run(tenantId, (tx) => this.pledges.listByLot(tx, tenantId, groupLotId));
  }
}
