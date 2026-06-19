// modules/contract-farming/services/contract-milestone.service.ts · record/complete milestones (buyer).
// Geo-photo gated progress tracking; no money. One ACID tx (UoW), outbox in-tx (Law 4), authz THROWS (Law 6).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ContractMilestone } from '../domain/contract-milestone.entity';
import { MilestoneType, DomainEvent } from '../domain/contract-farming.events';
import { ContractMilestoneRepository } from '../repositories/contract-milestone.repository';
import { FarmingContractRepository } from '../repositories/farming-contract.repository';
import { RecordMilestoneDto, CompleteMilestoneDto } from '../dto/create-contract-milestone.dto';
import { ContractNotFoundError, MilestoneNotFoundError, ContractFarmingForbiddenError } from '../domain/contract-farming.errors';
import { ContractActor } from './contract-template.service';

@Injectable()
export class ContractMilestoneService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ContractMilestoneRepository,
    private readonly contracts: FarmingContractRepository,
  ) {}
  async record(tenantId: string, actor: ContractActor, contractId: string, dto: RecordMilestoneDto) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return timed(this.metrics, 'contract_farming.milestone.record', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const contract = await this.contracts.getById(tenantId, contractId, tx);
        if (!contract) throw new ContractNotFoundError(contractId);
        if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractFarmingForbiddenError('only the contract buyer may record milestones');
        const m = ContractMilestone.record({ id: uuidv7(), contractId, growerId: dto.growerId ?? null, tenantId, milestoneType: dto.milestoneType as MilestoneType, dueOn: dto.dueOn ?? null, evidenceMediaId: null, data: dto.data });
        await this.repo.insert(tx, m);
        await this.flush(tx, tenantId, m.id, m.pullEvents());
        return m.toJSON();
      }, { userId: actor.userId }));
  }
  async complete(tenantId: string, actor: ContractActor, id: string, dto: CompleteMilestoneDto) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.uow.run(tenantId, async (tx) => {
      const m = await this.repo.getForUpdate(tx, tenantId, id);
      if (!m) throw new MilestoneNotFoundError(id);
      const contract = await this.contracts.getById(tenantId, m.contractId, tx);
      if (!contract || (contract.buyerUserId !== actor.userId && !actor.isAdmin)) throw new ContractFarmingForbiddenError('only the contract buyer may complete milestones');
      m.complete(new Date(), dto.evidenceMediaId ?? null, dto.data);
      await this.repo.update(tx, m);
      await this.flush(tx, tenantId, m.id, m.pullEvents());
      return m.toJSON();
    }, { userId: actor.userId });
  }
  async list(tenantId: string, actor: ContractActor, contractId: string) {
    const contract = await this.contracts.getById(tenantId, contractId);
    if (!contract) throw new ContractNotFoundError(contractId);
    if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractNotFoundError(contractId); // 404, no IDOR
    return (await this.repo.listForContract(tenantId, contractId)).map((m) => m.toJSON());
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'contract_milestone', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
