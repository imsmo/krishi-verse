// modules/contract-farming/services/contract-template.service.ts · template create + browse (buyer-admin).
// One ACID tx per write (UoW), outbox in-tx (Law 4), authz THROWS (Law 6). No money.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ContractTemplate } from '../domain/contract-template.entity';
import { DomainEvent } from '../domain/contract-farming.events';
import { ContractTemplateRepository } from '../repositories/contract-template.repository';
import { CreateTemplateDto } from '../dto/create-contract-template.dto';
import { TemplateNotFoundError, ContractFarmingForbiddenError } from '../domain/contract-farming.errors';

export interface ContractActor { userId: string; canManage: boolean; isAdmin: boolean; }

@Injectable()
export class ContractTemplateService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ContractTemplateRepository,
  ) {}
  async create(tenantId: string, actor: ContractActor, idemKey: string, dto: CreateTemplateDto) {
    if (!actor.canManage) throw new ContractFarmingForbiddenError('requires contract.manage');
    return this.idem.remember(idemKey, actor.userId, 'contract_farming.template.create', () =>
      timed(this.metrics, 'contract_farming.template.create', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const t = ContractTemplate.create({ id: uuidv7(), tenantId, defaultName: dto.defaultName, categoryId: dto.categoryId ?? null, bodyTemplate: dto.bodyTemplate, clauses: dto.clauses });
          await this.repo.insert(tx, t);
          await this.flush(tx, tenantId, t.id, t.pullEvents());
          return t.toJSON();
        }, { userId: actor.userId })));
  }
  async getById(tenantId: string, id: string) { const t = await this.repo.getUsable(tenantId, id); if (!t) throw new TemplateNotFoundError(id); return t.toJSON(); }
  async list(tenantId: string, activeOnly: boolean) { return (await this.repo.list(tenantId, activeOnly)).map((t) => t.toJSON()); }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'contract_template', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
