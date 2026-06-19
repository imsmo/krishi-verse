// modules/equipment/services/equipment-asset.service.ts · owner asset registry use-cases.
// One ACID tx per write (UoW), outbox in-tx (Law 4), idempotent create (Law 3), authz THROWS (Law 6: owner-only).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { EquipmentAsset } from '../domain/equipment-asset.entity';
import { AssetStatus, DomainEvent } from '../domain/equipment.events';
import { EquipmentAssetRepository } from '../repositories/equipment-asset.repository';
import { CreateAssetDto } from '../dto/create-equipment-asset.dto';
import { UpdateAssetDto } from '../dto/update-equipment-asset.dto';
import { AssetNotFoundError, RegNoExistsError, EquipmentForbiddenError } from '../domain/equipment.errors';

const QUOTA_METRIC = 'equipment_assets';
export interface EquipmentActor { userId: string; canManage: boolean; canRent: boolean; isAdmin: boolean; }

@Injectable()
export class EquipmentAssetService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: EquipmentAssetRepository,
  ) {}

  async register(tenantId: string, actor: EquipmentActor, idemKey: string, dto: CreateAssetDto) {
    if (!actor.canManage) throw new EquipmentForbiddenError('requires equipment.manage');
    return this.idem.remember(idemKey, actor.userId, 'equipment.asset.register', () =>
      timed(this.metrics, 'equipment.asset.register', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        return this.uow.run(tenantId, async (tx) => {
          const asset = EquipmentAsset.list({ id: uuidv7(), tenantId, ownerUserId: actor.userId, categoryId: dto.categoryId, productId: dto.productId ?? null,
            regNo: dto.regNo ?? null, yearOfMfg: dto.yearOfMfg ?? null, engineHours: dto.engineHours ?? null, hpRating: dto.hpRating ?? null,
            baseAddressId: dto.baseAddressId ?? null, serviceRadiusKm: dto.serviceRadiusKm ?? 25, gpsDeviceRef: dto.gpsDeviceRef ?? null });
          try { await this.repo.insert(tx, asset); } catch (e: any) { if (e?.code === '23505') throw new RegNoExistsError(); throw e; }
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          await this.flush(tx, tenantId, asset.id, asset.pullEvents());
          return asset.toJSON();
        }, { userId: actor.userId });
      }));
  }

  async update(tenantId: string, actor: EquipmentActor, id: string, dto: UpdateAssetDto) {
    return this.mutate(tenantId, actor, id, (a) => a.update(dto));
  }
  async setStatus(tenantId: string, actor: EquipmentActor, id: string, status: AssetStatus) {
    return this.mutate(tenantId, actor, id, (a) => a.setStatus(status));
  }
  async getById(tenantId: string, id: string) { const a = await this.repo.getById(tenantId, id); if (!a) throw new AssetNotFoundError(id); return a.toJSON(); }
  async list(tenantId: string, actor: EquipmentActor, q: { box: 'mine' | 'browse' | 'all'; categoryId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.isAdmin) throw new EquipmentForbiddenError('requires booking.manage');
    const rows = await this.repo.listFor(tenantId, { ownerUserId: q.box === 'mine' ? actor.userId : undefined, activeOnly: q.box === 'browse', categoryId: q.categoryId, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((a) => a.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async mutate(tenantId: string, actor: EquipmentActor, id: string, fn: (a: EquipmentAsset) => void) {
    if (!actor.canManage) throw new EquipmentForbiddenError('requires equipment.manage');
    return this.uow.run(tenantId, async (tx) => {
      const asset = await this.repo.getForUpdate(tx, tenantId, id);
      if (!asset) throw new AssetNotFoundError(id);
      if (asset.ownerUserId !== actor.userId && !actor.isAdmin) throw new EquipmentForbiddenError('only the owner may modify this asset');
      fn(asset);
      await this.repo.update(tx, asset);
      await this.flush(tx, tenantId, asset.id, asset.pullEvents());
      return asset.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'equipment_asset', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
