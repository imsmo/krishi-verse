// modules/contract-farming/services/farming-contract.service.ts · contract lifecycle + THE SETTLEMENT MONEY PATH.
// create → propose → sign → active → fulfilled (+ terminate). settleGrower (buyer): pay a grower for a
// delivered quantity at the FIXED price, automatically RECOVERING outstanding input advances — net =
// gross − recovered is paid buyer userMain → grower userMain via the wallet boundary (txnType
// 'contract_payment', zero-sum + idempotent — Law 2). Every write: one ACID tx (UoW), state via the machine
// (Law 5), outbox in-tx (Law 4), idempotent money mutations (Law 3), authz THROWS (Law 6). No version → FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { FarmingContract } from '../domain/farming-contract.entity';
import { ContractKind, PriceModel, DomainEvent, ContractFarmingEventType } from '../domain/contract-farming.events';
import { isActive } from '../domain/farming-contract.state';
import { FarmingContractRepository } from '../repositories/farming-contract.repository';
import { ContractGrowerRepository } from '../repositories/contract-grower.repository';
import { InputAdvanceRepository } from '../repositories/input-advance.repository';
import { CreateContractDto, SettleGrowerDto } from '../dto/create-farming-contract.dto';
import { ContractNotFoundError, GrowerNotFoundError, ContractNotActiveError, ContractFarmingForbiddenError } from '../domain/contract-farming.errors';
import { ContractActor } from './contract-template.service';

const QUOTA_METRIC = 'farming_contracts';
const contractNo = (id: string) => `CF-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 8).toUpperCase()}`;
const parseScaled = (s: string, dec: number): bigint => { const [i, f = ''] = s.split('.'); return BigInt(i + (f + '0'.repeat(dec)).slice(0, dec)); };

@Injectable()
export class FarmingContractService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly repo: FarmingContractRepository,
    private readonly growers: ContractGrowerRepository,
    private readonly advances: InputAdvanceRepository,
  ) {}

  async create(tenantId: string, actor: ContractActor, idemKey: string, dto: CreateContractDto) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.idem.remember(idemKey, actor.userId, 'contract_farming.contract.create', () =>
      timed(this.metrics, 'contract_farming.contract.create', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        return this.uow.run(tenantId, async (tx) => {
          const id = uuidv7();
          const contract = FarmingContract.create({ id, tenantId, contractNo: contractNo(id), templateId: dto.templateId ?? null, buyerUserId: actor.userId,
            contractKind: dto.contractKind as ContractKind, productId: dto.productId, totalQuantityMilli: parseScaled(dto.totalQuantity, 3), unitCode: dto.unitCode,
            priceModel: dto.priceModel as PriceModel, priceTerms: dto.priceTerms, qualitySpec: dto.qualitySpec, season: dto.season ?? null });
          await this.repo.insert(tx, contract);
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          await this.flush(tx, tenantId, contract.id, contract.pullEvents());
          return contract.toJSON();
        }, { userId: actor.userId });
      }));
  }

  async propose(tenantId: string, actor: ContractActor, id: string) { return this.mutate(tenantId, actor, id, (c) => c.propose()); }
  async sign(tenantId: string, actor: ContractActor, id: string) { return this.mutate(tenantId, actor, id, (c) => c.sign(new Date())); }
  async activate(tenantId: string, actor: ContractActor, id: string) { return this.mutate(tenantId, actor, id, (c) => c.activate()); }
  async fulfill(tenantId: string, actor: ContractActor, id: string) { return this.mutate(tenantId, actor, id, (c) => c.fulfill()); }
  async terminate(tenantId: string, actor: ContractActor, id: string, reason?: string) { return this.mutate(tenantId, actor, id, (c) => c.terminate(reason)); }

  /** Pay a grower for a delivered quantity (fixed price), recovering outstanding input advances first. */
  async settleGrower(tenantId: string, actor: ContractActor, contractId: string, idemKey: string, dto: SettleGrowerDto, ip: string | null) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.idem.remember(idemKey, actor.userId, 'contract_farming.settle', () =>
      timed(this.metrics, 'contract_farming.settle', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const contract = await this.repo.getForUpdate(tx, tenantId, contractId);
          if (!contract) throw new ContractNotFoundError(contractId);
          if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractFarmingForbiddenError('only the contract buyer may settle');
          if (!isActive(contract.status)) throw new ContractNotActiveError(contract.status);
          const grower = await this.growers.getById(tenantId, dto.growerId, tx);
          if (!grower || grower.contractId !== contractId) throw new GrowerNotFoundError(dto.growerId);
          const gross = contract.settlementGrossMinor(parseScaled(dto.deliveredQuantity, 3));   // fixed-price only (throws otherwise)
          // Recover outstanding advances (oldest first) up to the gross.
          let recovered = 0n; let remaining = gross;
          for (const adv of await this.advances.listOutstandingForUpdate(tx, tenantId, grower.id)) {
            if (remaining <= 0n) break;
            const took = adv.recover(remaining);
            if (took > 0n) { recovered += took; remaining -= took; await this.advances.updateRecovered(tx, adv); }
          }
          const net = gross - recovered;
          const settlementId = uuidv7();
          if (net > 0n) {
            await this.wallet.post(tx, { tenantId, txnType: 'contract_payment', idempotencyKey: `contract-settle:${settlementId}`, referenceType: 'farming_contract', referenceId: contractId, initiatedBy: actor.userId,
              legs: [{ account: userMain(contract.buyerUserId), amountMinor: -net }, { account: userMain(grower.farmerUserId), amountMinor: net }] });
          }
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'contract_farming.grower_settled', entityType: 'farming_contract', entityId: contractId, newValue: { growerId: grower.id, grossMinor: gross.toString(), recoveredMinor: recovered.toString(), netMinor: net.toString() }, ip });
          await this.outbox.write(tx, { tenantId, aggregateType: 'farming_contract', aggregateId: contractId, eventType: ContractFarmingEventType.GrowerSettled, payload: { v: 1, contractId, growerId: grower.id, grossMinor: gross.toString(), recoveredMinor: recovered.toString(), netMinor: net.toString() } });
          return { contractId, growerId: grower.id, grossMinor: gross.toString(), recoveredMinor: recovered.toString(), netMinor: net.toString() };
        }, { userId: actor.userId })));
  }

  async getById(tenantId: string, actor: ContractActor, id: string) {
    const c = await this.repo.getById(tenantId, id);
    if (!c) throw new ContractNotFoundError(id);
    if (c.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractNotFoundError(id); // 404, no IDOR
    return c.toJSON();
  }
  async list(tenantId: string, actor: ContractActor, q: { box: 'mine' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new ContractFarmingForbiddenError('requires booking.manage');
    const rows = await this.repo.listFor(tenantId, { buyerUserId: q.box === 'mine' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((c) => c.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async mutate(tenantId: string, actor: ContractActor, id: string, fn: (c: FarmingContract) => void) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.uow.run(tenantId, async (tx) => {
      const contract = await this.repo.getForUpdate(tx, tenantId, id);
      if (!contract) throw new ContractNotFoundError(id);
      if (contract.buyerUserId !== actor.userId && !actor.isAdmin) throw new ContractFarmingForbiddenError('only the contract buyer may act here');
      fn(contract);
      await this.repo.update(tx, contract);
      await this.flush(tx, tenantId, contract.id, contract.pullEvents());
      return contract.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'farming_contract', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
