// modules/labour/services/worker-profile.service.ts
// Worker self-registration + preference edits. One profile per user (worker_profiles.user_id UNIQUE),
// guarded under the tx. Every write: one ACID tx (UoW), domain events drained to the outbox in-tx (Law 4),
// idempotent registration (Law 3). No version column → the profile row is locked FOR UPDATE on edit.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { WorkerProfile } from '../domain/worker-profile.entity';
import { DomainEvent } from '../domain/labour.events';
import { WorkerProfileRepository } from '../repositories/worker-profile.repository';
import { RegisterWorkerDto } from '../dto/create-worker-profile.dto';
import { UpdateWorkerDto } from '../dto/update-worker-profile.dto';
import { WorkerAlreadyRegisteredError, WorkerProfileNotFoundError, LabourForbiddenError } from '../domain/labour.errors';

const toBig = (s?: string | null) => (s == null ? null : BigInt(s));

@Injectable()
export class WorkerProfileService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: WorkerProfileRepository,
  ) {}

  /** Register the CALLER as a worker (one profile per user). Idempotent on the key. */
  async register(tenantId: string, userId: string, idemKey: string, dto: RegisterWorkerDto) {
    return this.idem.remember(idemKey, userId, 'labour.worker.register', () =>
      timed(this.metrics, 'labour.worker.register', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          if (await this.repo.findByUser(tenantId, userId, tx)) throw new WorkerAlreadyRegisteredError();
          const worker = WorkerProfile.register({
            id: uuidv7(), userId, tenantId, onboardedBy: userId,
            villageRegionId: dto.villageRegionId ?? null, travelKm: dto.travelKm, stayAwayOk: dto.stayAwayOk,
            minWageExpectationMinor: toBig(dto.minWageExpectationMinor), autoAcceptAboveMinor: toBig(dto.autoAcceptAboveMinor),
            hasSmartphone: dto.hasSmartphone, emergencyContactName: dto.emergencyContactName ?? null,
            emergencyContactPhone: dto.emergencyContactPhone ?? null, eshramNo: dto.eshramNo ?? null,
          });
          await this.repo.insert(tx, worker);
          if (dto.skillIds) await this.repo.setSkills(tx, worker.id, dto.skillIds);   // self-declared skills (worker_skills)
          await this.flush(tx, tenantId, worker.id, worker.pullEvents());
          return this.serialize(worker);
        }, { userId })));
  }

  async updateMine(tenantId: string, userId: string, id: string, dto: UpdateWorkerDto) {
    return this.uow.run(tenantId, async (tx) => {
      const worker = await this.repo.getForUpdate(tx, tenantId, id);
      if (!worker) throw new WorkerProfileNotFoundError(id);
      if (worker.userId !== userId) throw new LabourForbiddenError('only the worker may edit their profile');
      worker.updatePreferences({
        villageRegionId: dto.villageRegionId, travelKm: dto.travelKm, stayAwayOk: dto.stayAwayOk,
        minWageExpectationMinor: toBig(dto.minWageExpectationMinor) ?? undefined, autoAcceptAboveMinor: toBig(dto.autoAcceptAboveMinor) ?? undefined,
        hasSmartphone: dto.hasSmartphone, emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone, eshramNo: dto.eshramNo,
      });
      if (dto.discoverable !== undefined) worker.updateDiscoverability(dto.discoverable);   // explicit consent decision
      if (dto.skillIds) await this.repo.setSkills(tx, worker.id, dto.skillIds);   // replace the self-declared skill set
      await this.repo.update(tx, worker);
      await this.flush(tx, tenantId, worker.id, worker.pullEvents());
      return this.serialize(worker);
    }, { userId });
  }

  async getMine(tenantId: string, userId: string) {
    const worker = await this.repo.findByUser(tenantId, userId);
    if (!worker) return { worker: null };
    const skillIds = await this.repo.listSkillIds(tenantId, worker.id);
    return { worker: { ...this.serialize(worker), skillIds } };
  }
  async getById(tenantId: string, id: string) {
    const worker = await this.repo.getById(tenantId, id);
    if (!worker) throw new WorkerProfileNotFoundError(id);
    return this.serialize(worker);
  }
  async list(tenantId: string, q: { villageRegionId?: string; ageVerified?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((w) => this.serialize(w));
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  /** P0-2 employer marketplace read: consented worker CARDS. Identity fields are populated by the repo's
   *  discoverable-gated SQL — a non-consenting worker appears only as an anonymous availability card. */
  async listCards(tenantId: string, q: { villageRegionId?: string; ageVerified?: boolean; cursor?: { c: string; id: string }; limit: number }) {
    const items = await this.repo.listCards(tenantId, q);
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  async getCard(tenantId: string, id: string) {
    const card = await this.repo.getCard(tenantId, id);
    if (!card) throw new WorkerProfileNotFoundError(id);
    return card;
  }

  private serialize(w: WorkerProfile) {
    const v = w.toProps();
    // NOTE: this is the worker's OWN full profile (getMine / register / updateMine) — discoverable is the worker's
    // own consent flag, safe to return to themselves. The employer-facing PII gate lives in listCards/getCard.
    return { id: v.id, userId: v.userId, ageVerified18: v.ageVerified18, villageRegionId: v.villageRegionId,
      travelKm: v.travelKm, stayAwayOk: v.stayAwayOk, minWageExpectationMinor: v.minWageExpectationMinor?.toString() ?? null,
      autoAcceptAboveMinor: v.autoAcceptAboveMinor?.toString() ?? null, hasSmartphone: v.hasSmartphone,
      discoverable: v.discoverable,
      ratingAvg: v.ratingAvg, bookingsCompleted: v.bookingsCompleted, noShowCount: v.noShowCount, createdAt: v.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, workerId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'worker_profile', aggregateId: workerId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
