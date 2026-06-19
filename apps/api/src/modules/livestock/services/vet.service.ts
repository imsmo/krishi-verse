// modules/livestock/services/vet.service.ts
// Vet marketplace supply side: a veterinarian self-registers ONE profile (user_id UNIQUE) and maintains a
// priced service catalog (consult/vaccination/AI/PD/surgery…). Every write: one ACID tx (UoW), outbox
// in-tx (Law 4), idempotent registration (Law 3), authz that THROWS (Law 6). Prices are bigint minor units.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { VetProfile } from '../domain/vet-profile.entity';
import { VetService as VetServiceEntity } from '../domain/vet-service.entity';
import { DomainEvent, VetPricingUnit } from '../domain/livestock.events';
import { LivestockEventType } from '../domain/livestock.events';
import { VetProfileRepository } from '../repositories/vet-profile.repository';
import { VetServiceRepository } from '../repositories/vet-service.repository';
import { RegisterVetDto, UpsertVetServiceDto } from '../dto/create-vet-profile.dto';
import { VetAlreadyRegisteredError, VetProfileNotFoundError, LivestockForbiddenError } from '../domain/livestock.errors';

export interface VetActor { userId: string; canManageVet: boolean; }

@Injectable()
export class VetService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly vets: VetProfileRepository,
    private readonly services: VetServiceRepository,
  ) {}

  async register(tenantId: string, actor: VetActor, idemKey: string, dto: RegisterVetDto) {
    if (!actor.canManageVet) throw new LivestockForbiddenError('requires vet.manage');
    return this.idem.remember(idemKey, actor.userId, 'livestock.vet.register', () =>
      timed(this.metrics, 'livestock.vet.register', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          if (await this.vets.findByUser(tenantId, actor.userId, tx)) throw new VetAlreadyRegisteredError();
          const vet = VetProfile.register({ id: uuidv7(), userId: actor.userId, tenantId, registrationNo: dto.registrationNo,
            isAiTechnician: dto.isAiTechnician, serviceRadiusKm: dto.serviceRadiusKm, baseRegionId: dto.baseRegionId ?? null });
          await this.vets.insert(tx, vet);
          await this.flush(tx, tenantId, vet.id, vet.pullEvents());
          return vet.toJSON();
        }, { userId: actor.userId })));
  }

  /** Add/update a priced service on the caller's OWN vet profile (idempotent upsert per service type). */
  async upsertService(tenantId: string, actor: VetActor, dto: UpsertVetServiceDto) {
    if (!actor.canManageVet) throw new LivestockForbiddenError('requires vet.manage');
    return this.uow.run(tenantId, async (tx) => {
      const vet = await this.vets.findByUser(tenantId, actor.userId, tx);
      if (!vet) throw new VetProfileNotFoundError('self');
      const serviceTypeId = await this.services.resolveServiceTypeId(tx, dto.serviceTypeCode);
      const svc = VetServiceEntity.create({ id: uuidv7(), vetId: vet.id, serviceTypeId, priceMinor: BigInt(dto.priceMinor),
        pricingUnit: dto.pricingUnit as VetPricingUnit, isEmergencyAvailable: dto.isEmergencyAvailable });
      await this.services.upsert(tx, svc);
      await this.outbox.write(tx, { tenantId, aggregateType: 'vet_profile', aggregateId: vet.id, eventType: LivestockEventType.VetServiceSet, payload: { v: 1, vetId: vet.id, serviceTypeId, priceMinor: dto.priceMinor } });
      return svc.toJSON();
    }, { userId: actor.userId });
  }

  async getMine(tenantId: string, userId: string) {
    const vet = await this.vets.findByUser(tenantId, userId);
    if (!vet) return { vet: null, services: [] };
    return { vet: vet.toJSON(), services: (await this.services.listByVet(tenantId, vet.id)).map((s) => s.toJSON()) };
  }
  async getById(tenantId: string, id: string) {
    const vet = await this.vets.getById(tenantId, id);
    if (!vet) throw new VetProfileNotFoundError(id);
    return { vet: vet.toJSON(), services: (await this.services.listByVet(tenantId, vet.id)).map((s) => s.toJSON()) };
  }
  async list(tenantId: string, q: { baseRegionId?: string; isAiTechnician?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.vets.listFor(tenantId, q);
    const items = rows.map((v) => v.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, vetId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'vet_profile', aggregateId: vetId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
