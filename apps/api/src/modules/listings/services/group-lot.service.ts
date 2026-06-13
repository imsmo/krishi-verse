// modules/listings/services/group-lot.service.ts · FPO pooling use-cases (PRD §7.7).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { GroupLot } from '../domain/group-lot.entity';
import { GroupLotPledge } from '../domain/group-lot-pledge.entity';
import { GroupLotRepository } from '../repositories/group-lot.repository';
import { GroupLotPledgeRepository } from '../repositories/group-lot-pledge.repository';
import { DomainError } from '../../../shared/errors/app-error';
import { CreateGroupLotDto } from '../dto/create-group-lot.dto';

@Injectable()
export class GroupLotService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly lots: GroupLotRepository,
    private readonly pledges: GroupLotPledgeRepository,
  ) {}

  async create(tenantId: string, coordinatorUserId: string, dto: CreateGroupLotDto): Promise<{ id: string }> {
    const id = uuidv7();
    const lot = GroupLot.create({ id, tenantId, coordinatorUserId, productId: dto.productId,
      targetQuantity: dto.targetQuantity, unitCode: dto.unitCode,
      pledgeDeadline: new Date(dto.pledgeDeadline), coordinationFeeBps: dto.coordinationFeeBps });
    await this.uow.run(tenantId, async (tx) => { await this.lots.insert(tx, lot); }, { userId: coordinatorUserId });
    return { id };
  }

  async pledge(tenantId: string, farmerUserId: string, groupLotId: string, quantity: number): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const lot = await this.lots.getForUpdate(tx, tenantId, groupLotId);
      if (!lot) throw new DomainError('GROUP_LOT_NOT_FOUND', 'Group lot not found', 404);
      lot.addPledge(quantity);
      await this.pledges.upsert(tx, GroupLotPledge.of({ id: uuidv7(), tenantId, groupLotId, farmerUserId, quantity }));
      await this.lots.update(tx, lot);
      if (lot.status === 'ready') {
        await this.outbox.write(tx, { tenantId, aggregateType: 'group_lot', aggregateId: groupLotId,
          eventType: 'listing.group_lot_ready', payload: { v: 1, groupLotId } });
      }
    }, { userId: farmerUserId });
  }
}
