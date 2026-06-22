// modules/catalogue/services/product-batch.service.ts · tenant store inventory (expiry/recall).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ProductBatch } from '../domain/product-batch.entity';
import { ProductNotFoundError, BatchNotFoundError } from '../domain/catalogue.errors';
import { ProductBatchRepository } from '../repositories/product-batch.repository';
import { ProductRepository } from '../repositories/product.repository';
import { CreateBatchDto, QueryBatchDto } from '../dto/create-product-batch.dto';

@Injectable()
export class ProductBatchService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: ProductBatchRepository,
    private readonly products: ProductRepository,
  ) {}

  async create(tenantId: string, actorUserId: string, idemKey: string, dto: CreateBatchDto): Promise<{ id: string }> {
    return this.idem.remember(idemKey, actorUserId, 'catalogue.batch.create', () =>
      timed(this.metrics, 'catalogue.batch.create', { tenant: tenantId }, async () => {
        if (!(await this.products.getVisibleById(tenantId, dto.productId))) throw new ProductNotFoundError(dto.productId);
        const id = uuidv7();
        const batch = ProductBatch.create({ id, tenantId, productId: dto.productId, sellerUserId: actorUserId, batchNo: dto.batchNo,
          mfgDate: dto.mfgDate ?? null, expiryDate: dto.expiryDate ?? null, mrpMinor: dto.mrpMinor ? BigInt(dto.mrpMinor) : null,
          currencyCode: dto.currencyCode, qtyReceived: dto.qtyReceived, unitCode: dto.unitCode });
        await this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, batch);
          await this.flush(tx, tenantId, id, batch.pullEvents());
        }, { userId: actorUserId });
        return { id };
      }));
  }

  list(tenantId: string, q: QueryBatchDto) {
    return this.repo.list(tenantId, { productId: q.productId, includeExpired: q.includeExpired, limit: q.limit })
      .then((rows) => rows.map((b) => { const p = b.toProps(); return { ...p, mrpMinor: p.mrpMinor?.toString() ?? null }; }));
  }

  async recall(tenantId: string, actorUserId: string, id: string, reason: string, ip: string | null): Promise<{ ok: true }> {
    await this.uow.run(tenantId, async (tx) => {
      const batch = await this.repo.getForUpdate(tx, tenantId, id);
      if (!batch) throw new BatchNotFoundError(id);
      batch.recall(reason);
      await this.repo.update(tx, batch);
      await this.flush(tx, tenantId, id, batch.pullEvents());
      await this.audit.write(tx, { tenantId, actorUserId, action: 'catalogue.batch_recalled', entityType: 'product_batch', entityId: id, reason, ip });
    }, { userId: actorUserId });
    return { ok: true };
  }

  /** Worker-only: emit a catalogue.batch_expiring alert to the outbox (comm dedups/rate-limits downstream). */
  async flagExpiring(tenantId: string, batchId: string, productId: string, expiryDate: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      await this.outbox.write(tx, { tenantId, aggregateType: 'product_batch', aggregateId: batchId, eventType: 'catalogue.batch_expiring', payload: { v: 1, batchId, productId, expiryDate } });
    }, { userId: 'system' });
  }

  private async flush(tx: TxContext, tenantId: string, id: string, events: { type: string; payload: Record<string, unknown> }[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'product_batch', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
