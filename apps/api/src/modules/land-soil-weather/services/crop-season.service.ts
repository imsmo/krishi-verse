// modules/land-soil-weather/services/crop-season.service.ts · crop-season tracking on an owned parcel.
// plan → sow → harvest (+ abandon). Every write verifies the parcel belongs to the caller (anti-IDOR). One
// ACID tx (UoW), state via the machine (Law 5), outbox in-tx (Law 4), authz THROWS (Law 6). No money.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { CropSeason } from '../domain/crop-season.entity';
import { CropSeasonName, DomainEvent } from '../domain/land-soil-weather.events';
import { CropSeasonRepository } from '../repositories/crop-season.repository';
import { LandParcelRepository } from '../repositories/land-parcel.repository';
import { PlanCropSeasonDto, SowCropSeasonDto, HarvestCropSeasonDto } from '../dto/create-crop-season.dto';
import { ParcelNotFoundError, CropSeasonNotFoundError, LandForbiddenError } from '../domain/land-soil-weather.errors';
import { LandActor } from './land-parcel.service';

const toMilli = (s?: string): bigint | null => (s == null ? null : BigInt(Math.round(Number(s) * 1000)));

@Injectable()
export class CropSeasonService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: CropSeasonRepository,
    private readonly parcels: LandParcelRepository,
  ) {}

  async plan(tenantId: string, actor: LandActor, idemKey: string, dto: PlanCropSeasonDto) {
    if (!actor.canManage) throw new LandForbiddenError('requires land.manage');
    return this.idem.remember(idemKey, actor.userId, 'land.crop_season.plan', () =>
      timed(this.metrics, 'land.crop_season.plan', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const parcel = await this.parcels.getById(tenantId, dto.parcelId, tx);
          if (!parcel) throw new ParcelNotFoundError(dto.parcelId);
          parcel.assertOwner(actor.userId, actor.isAdmin);
          const c = CropSeason.plan({ id: uuidv7(), tenantId, parcelId: dto.parcelId, productId: dto.productId, season: dto.season as CropSeasonName, year: dto.year,
            sownOn: dto.sownOn ?? null, expectedHarvest: dto.expectedHarvest ?? null, expectedYieldMilli: toMilli(dto.expectedYield) });
          await this.repo.insert(tx, c);
          await this.flush(tx, tenantId, c.id, c.pullEvents());
          return c.toJSON();
        }, { userId: actor.userId })));
  }

  async sow(tenantId: string, actor: LandActor, id: string, dto: SowCropSeasonDto) { return this.mutate(tenantId, actor, id, (c) => c.sow(dto.sownOn)); }
  async harvest(tenantId: string, actor: LandActor, id: string, dto: HarvestCropSeasonDto) { return this.mutate(tenantId, actor, id, (c) => c.harvest(toMilli(dto.actualYield))); }
  async abandon(tenantId: string, actor: LandActor, id: string, reason?: string) { return this.mutate(tenantId, actor, id, (c) => c.abandon(reason)); }

  async list(tenantId: string, actor: LandActor, parcelId: string, status?: string) {
    const parcel = await this.parcels.getById(tenantId, parcelId);
    if (!parcel) throw new ParcelNotFoundError(parcelId);
    if (parcel.ownerUserId !== actor.userId && !actor.isAdmin) throw new ParcelNotFoundError(parcelId); // 404, no IDOR
    return (await this.repo.listForParcel(tenantId, parcelId, status)).map((c) => c.toJSON());
  }

  private async mutate(tenantId: string, actor: LandActor, id: string, fn: (c: CropSeason) => void) {
    if (!actor.canManage) throw new LandForbiddenError('requires land.manage');
    return this.uow.run(tenantId, async (tx) => {
      const c = await this.repo.getForUpdate(tx, tenantId, id);
      if (!c) throw new CropSeasonNotFoundError(id);
      const parcel = await this.parcels.getById(tenantId, c.parcelId, tx);
      if (!parcel || (parcel.ownerUserId !== actor.userId && !actor.isAdmin)) throw new LandForbiddenError('only the parcel owner may act here');
      fn(c);
      await this.repo.update(tx, c);
      await this.flush(tx, tenantId, c.id, c.pullEvents());
      return c.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'crop_season', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
