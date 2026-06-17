// modules/catalogue/services/category.service.ts · read tree + per-tenant enable/disable (audited).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { CACHE_SERVICE, CacheService } from '../../../core/cache/cache.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { CategoryRepository } from '../repositories/category.repository';
import { CategoryNotFoundError } from '../domain/catalogue.errors';
import { QueryCategoryDto, ToggleTenantCategoryDto } from '../dto/query-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: CategoryRepository,
  ) {}

  async tree(tenantId: string, q: QueryCategoryDto) {
    return timed(this.metrics, 'catalogue.category_tree', { tenant: tenantId }, async () => {
      // cache the common "active global tree" read; tenant-scoped/filtered reads bypass cache
      const cacheable = q.activeOnly && !q.parentId && !q.rootCode && !q.enabledForTenant;
      const load = async () => (await this.repo.tree(tenantId, { activeOnly: q.activeOnly, rootCode: q.rootCode, parentId: q.parentId, enabledForTenant: q.enabledForTenant })).map((c) => c.props);
      return cacheable ? this.cache.wrap('catalogue:tree:active', 300, load) : load();
    });
  }

  async toggleTenantCategory(tenantId: string, actorUserId: string, dto: ToggleTenantCategoryDto, ip: string | null) {
    const exists = await this.repo.existsActive(tenantId, dto.categoryId);
    if (!exists) throw new CategoryNotFoundError(dto.categoryId);
    await this.uow.run(tenantId, async (tx) => {
      await this.repo.toggleTenantCategory(tx, tenantId, dto.categoryId, dto.isEnabled);
      await this.outbox.write(tx, { tenantId, aggregateType: 'tenant_category', aggregateId: dto.categoryId, eventType: 'catalogue.tenant_category_toggled', payload: { v: 1, categoryId: dto.categoryId, isEnabled: dto.isEnabled } });
      await this.audit.write(tx, { tenantId, actorUserId, action: 'catalogue.category_toggled', entityType: 'tenant_category', entityId: dto.categoryId, newValue: { isEnabled: dto.isEnabled }, ip });
    }, { userId: actorUserId });
    return { ok: true };
  }
}
