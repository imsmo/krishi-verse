// modules/contract-farming/services/input-advance.service.ts · disburse a buyer input advance to a grower.
// THE MONEY PATH: buyer userMain → grower userMain (txnType 'contract_payment', referenceType
// 'contract_input_advance', zero-sum + idempotent — Law 2); recovered at settlement. One ACID tx (UoW),
// outbox in-tx (Law 4), idempotent (Law 3), authz THROWS (Law 6). Contract must be active.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { InputAdvance } from '../domain/input-advance.entity';
import { DomainEvent } from '../domain/contract-farming.events';
import { isActive } from '../domain/farming-contract.state';
import { InputAdvanceRepository } from '../repositories/input-advance.repository';
import { FarmingContractRepository } from '../repositories/farming-contract.repository';
import { ContractGrowerRepository } from '../repositories/contract-grower.repository';
import { DisburseAdvanceDto } from '../dto/create-input-advance.dto';
import { ContractNotFoundError, GrowerNotFoundError, ContractNotActiveError, ContractFarmingForbiddenError } from '../domain/contract-farming.errors';
import { ContractActor } from './contract-template.service';

@Injectable()
export class InputAdvanceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly repo: InputAdvanceRepository,
    private readonly contracts: FarmingContractRepository,
    private readonly growers: ContractGrowerRepository,
  ) {}

  async disburse(tenantId: string, actor: ContractActor, contractId: string, idemKey: string, dto: DisburseAdvanceDto, ip: string | null) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.idem.remember(idemKey, actor.userId, 'contract_farming.advance.disburse', () =>
      timed(this.metrics, 'contract_farming.advance.disburse', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const contract = await this.contracts.getForUpdate(tx, tenantId, contractId);
          if (!contract) throw new ContractNotFoundError(contractId);
          if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractFarmingForbiddenError('only the contract buyer may disburse advances');
          if (!isActive(contract.status)) throw new ContractNotActiveError(contract.status);
          const grower = await this.growers.getById(tenantId, dto.growerId, tx);
          if (!grower || grower.contractId !== contractId) throw new GrowerNotFoundError(dto.growerId);
          const advance = InputAdvance.disburse({ id: uuidv7(), contractId, growerId: grower.id, tenantId, productId: dto.productId ?? null, description: dto.description ?? null, valueMinor: BigInt(dto.valueMinor) });
          await this.repo.insert(tx, advance);
          // Buyer funds the grower's inputs — a balanced, idempotent wallet transfer (Law 2).
          await this.wallet.post(tx, { tenantId, txnType: 'contract_payment', idempotencyKey: `contract-advance:${advance.id}`, referenceType: 'contract_input_advance', referenceId: advance.id, initiatedBy: actor.userId,
            legs: [{ account: userMain(contract.buyerUserId), amountMinor: -advance.valueMinor }, { account: userMain(grower.farmerUserId), amountMinor: advance.valueMinor }] });
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'contract_farming.advance_disbursed', entityType: 'contract_input_advance', entityId: advance.id, newValue: { growerId: grower.id, valueMinor: dto.valueMinor }, ip });
          await this.flush(tx, tenantId, advance.id, advance.pullEvents());
          return advance.toJSON();
        }, { userId: actor.userId })));
  }
  async list(tenantId: string, actor: ContractActor, contractId: string, growerId?: string) {
    const contract = await this.contracts.getById(tenantId, contractId);
    if (!contract) throw new ContractNotFoundError(contractId);
    if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractNotFoundError(contractId); // 404, no IDOR
    return (await this.repo.listFor(tenantId, contractId, growerId)).map((a) => a.toJSON());
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'contract_input_advance', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
