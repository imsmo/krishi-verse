// modules/contract-farming/services/contract-grower.service.ts · enrol a grower onto a contract (buyer).
// One ACID tx per write (UoW), outbox in-tx (Law 4), authz THROWS (Law 6: only the contract's buyer/admin).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ContractGrower } from '../domain/contract-grower.entity';
import { DomainEvent } from '../domain/contract-farming.events';
import { acceptsEnrolment } from '../domain/farming-contract.state';
import { ContractGrowerRepository } from '../repositories/contract-grower.repository';
import { FarmingContractRepository } from '../repositories/farming-contract.repository';
import { EnrolGrowerDto } from '../dto/create-contract-grower.dto';
import { ContractNotFoundError, GrowerAlreadyEnrolledError, InvalidContractError, ContractFarmingForbiddenError } from '../domain/contract-farming.errors';
import { ContractActor } from './contract-template.service';

const parseScaled = (s: string, dec: number): bigint => { const [i, f = ''] = s.split('.'); return BigInt(i + (f + '0'.repeat(dec)).slice(0, dec)); };

@Injectable()
export class ContractGrowerService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ContractGrowerRepository,
    private readonly contracts: FarmingContractRepository,
  ) {}
  async enrol(tenantId: string, actor: ContractActor, contractId: string, idemKey: string, dto: EnrolGrowerDto) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.idem.remember(idemKey, actor.userId, 'contract_farming.grower.enrol', () =>
      timed(this.metrics, 'contract_farming.grower.enrol', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const contract = await this.contracts.getById(tenantId, contractId, tx);
          if (!contract) throw new ContractNotFoundError(contractId);
          if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractFarmingForbiddenError('only the contract buyer may enrol growers');
          if (!acceptsEnrolment(contract.status)) throw new InvalidContractError(`cannot enrol on a ${contract.status} contract`);
          const grower = ContractGrower.enrol({ id: uuidv7(), contractId, tenantId, farmerUserId: dto.farmerUserId, landParcelId: dto.landParcelId ?? null, committedQuantityMilli: parseScaled(dto.committedQuantity, 3) });
          try { await this.repo.insert(tx, grower); } catch (e: any) { if (e?.code === '23505') throw new GrowerAlreadyEnrolledError(); throw e; }
          await this.flush(tx, tenantId, grower.id, grower.pullEvents());
          return grower.toJSON();
        }, { userId: actor.userId })));
  }
  async list(tenantId: string, actor: ContractActor, contractId: string) {
    const contract = await this.contracts.getById(tenantId, contractId);
    if (!contract) throw new ContractNotFoundError(contractId);
    if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractNotFoundError(contractId); // 404, no IDOR
    return (await this.repo.listForContract(tenantId, contractId)).map((g) => g.toJSON());
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'contract_grower', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
