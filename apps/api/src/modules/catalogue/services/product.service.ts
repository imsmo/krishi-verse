// modules/catalogue/services/product.service.ts
// Tenant-private product master. Every write: validate category + attribute values against
// their definitions, one ACID tx (UnitOfWork), outbox event in-tx (Law 4), idempotency on
// create (Law 3), quota, enforced ownership (RLS + tenant-scoped getForUpdate), metrics.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { CACHE_SERVICE, CacheService } from '../../../core/cache/cache.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Product } from '../domain/product.entity';
import { ProductNotFoundError, CategoryNotFoundError } from '../domain/catalogue.errors';
import { ProductRepository } from '../repositories/product.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { CreateProductDto, UpdateProductDto } from '../dto/create-product.dto';
import { ProductAttr } from '../dto/dto-attr';

const QUOTA = 'max_products_month';
const cacheKey = (t: string, id: string) => `t:${t}:product:${id}`;

@Injectable()
export class ProductService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly attrs: AttributeDefinitionRepository,
  ) {}

  /** Validate submitted attribute values against their definitions (type/min/max/options). */
  private async validateAttrs(tenantId: string, list: ProductAttr[] = []): Promise<void> {
    if (!list.length) return;
    const validators = await this.attrs.validatorsByIds(tenantId, list.map((a) => a.attributeId));
    for (const a of list) {
      const v = validators.get(a.attributeId);
      if (!v) throw new CategoryNotFoundError(`attribute ${a.attributeId}`); // unknown attribute id
      const value = a.kind === 'text' ? a.text : a.kind === 'number' ? a.number : a.kind === 'bool' ? a.bool : a.kind === 'date' ? a.date : a.optionId;
      v.def.validate(value, v.optionIds);
    }
  }

  async create(tenantId: string, actorUserId: string, idemKey: string, dto: CreateProductDto): Promise<{ id: string }> {
    return this.idem.remember(idemKey, actorUserId, 'catalogue.product.create', () =>
      timed(this.metrics, 'catalogue.product.create', { tenant: tenantId }, async () => {
        if (!(await this.categories.existsActive(tenantId, dto.categoryId))) throw new CategoryNotFoundError(dto.categoryId);
        await this.validateAttrs(tenantId, dto.attributes);
        await this.quota.assertWithinLimit(tenantId, QUOTA);
        const id = uuidv7();
        const product = Product.create({ id, categoryId: dto.categoryId, code: dto.code ?? null, defaultName: dto.defaultName,
          brandId: dto.brandId ?? null, defaultUnit: dto.defaultUnit, gstRatePct: dto.gstRatePct ?? null, hsnCode: dto.hsnCode ?? null,
          isPerishable: dto.isPerishable, shelfLifeDays: dto.shelfLifeDays ?? null, tenantId });
        await this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, product);
          if (dto.attributes?.length) await this.repo.upsertAttrs(tx, id, dto.attributes);
          await this.quota.increment(tx, tenantId, QUOTA, 1);
          await this.flush(tx, tenantId, id, product.pullEvents());
        }, { userId: actorUserId });
        this.metrics.inc('catalogue.product_created', { tenant: tenantId });
        return { id };
      }));
  }

  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateProductDto): Promise<void> {
    await timed(this.metrics, 'catalogue.product.update', { tenant: tenantId }, async () => {
      if (dto.categoryId && !(await this.categories.existsActive(tenantId, dto.categoryId))) throw new CategoryNotFoundError(dto.categoryId);
      await this.validateAttrs(tenantId, dto.attributes);
      await this.uow.run(tenantId, async (tx) => {
        const product = await this.repo.getForUpdate(tx, tenantId, id);
        if (!product) throw new ProductNotFoundError(id);
        product.update({ categoryId: dto.categoryId, defaultName: dto.defaultName, brandId: dto.brandId, defaultUnit: dto.defaultUnit, gstRatePct: dto.gstRatePct, hsnCode: dto.hsnCode, isPerishable: dto.isPerishable, shelfLifeDays: dto.shelfLifeDays });
        await this.repo.update(tx, product);
        if (dto.attributes?.length) await this.repo.upsertAttrs(tx, id, dto.attributes);
        await this.flush(tx, tenantId, id, product.pullEvents());
      }, { userId: actorUserId });
      await this.cache.del(cacheKey(tenantId, id));
    });
  }

  async deactivate(tenantId: string, actorUserId: string, id: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const product = await this.repo.getForUpdate(tx, tenantId, id);
      if (!product) throw new ProductNotFoundError(id);
      product.deactivate();
      await this.repo.update(tx, product);
      await this.flush(tx, tenantId, id, product.pullEvents());
    }, { userId: actorUserId });
    await this.cache.del(cacheKey(tenantId, id));
  }

  async getById(tenantId: string, id: string) {
    return this.cache.wrap(cacheKey(tenantId, id), 300, async () => {
      const p = await this.repo.getVisibleById(tenantId, id);
      if (!p) throw new ProductNotFoundError(id);
      return p.toProps();
    });
  }

  private async flush(tx: TxContext, tenantId: string, id: string, events: { type: string; payload: Record<string, unknown> }[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'product', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
