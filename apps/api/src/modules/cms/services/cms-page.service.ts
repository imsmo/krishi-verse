// modules/cms/services/cms-page.service.ts · author + publish CMS pages (tenant-owned; money-free).
// create mints the next version for a slug (draft); edit is draft-only; publish stamps published_at AND archives
// the slug's previously-published version (so exactly one is live); archive retires a version. Authoring needs
// cms.manage + writes an audit row in-tx. Public getBySlug serves the live page (any authenticated user).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { CmsPage } from '../domain/cms-page.entity';
import { DomainEvent, PageKind } from '../domain/cms.events';
import { CmsPageRepository } from '../repositories/cms-page.repository';
import { CreatePageDto } from '../dto/create-cms-page.dto';
import { UpdatePageDto } from '../dto/update-cms-page.dto';
import { PageNotFoundError, CmsForbiddenError } from '../domain/cms.errors';

export interface CmsActor { userId: string; canManage: boolean; }

@Injectable()
export class CmsPageService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: CmsPageRepository,
  ) {}

  async create(tenantId: string, actor: CmsActor, dto: CreatePageDto) {
    if (!actor.canManage) throw new CmsForbiddenError('requires cms.manage');
    return timed(this.metrics, 'cms.page.create', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const version = (await this.repo.maxVersion(tx, tenantId, dto.slug)) + 1;
        const page = CmsPage.create({ id: uuidv7(), tenantId, slug: dto.slug, pageKind: dto.pageKind as PageKind, defaultTitle: dto.defaultTitle, body: dto.body, version });
        await this.repo.insert(tx, page, tenantId, actor.userId);
        return page.toJSON();
      }, { userId: actor.userId }));
  }
  async update(tenantId: string, actor: CmsActor, id: string, dto: UpdatePageDto) {
    if (!actor.canManage) throw new CmsForbiddenError('requires cms.manage');
    return this.uow.run(tenantId, async (tx) => {
      const page = await this.repo.getForUpdate(tx, tenantId, id);
      if (!page) throw new PageNotFoundError(id);
      page.edit({ ...dto, pageKind: dto.pageKind as PageKind | undefined });
      await this.repo.update(tx, page, tenantId);
      return page.toJSON();
    }, { userId: actor.userId });
  }
  async publish(tenantId: string, actor: CmsActor, id: string, ip: string | null) {
    if (!actor.canManage) throw new CmsForbiddenError('requires cms.manage');
    return this.uow.run(tenantId, async (tx) => {
      const page = await this.repo.getForUpdate(tx, tenantId, id);
      if (!page) throw new PageNotFoundError(id);
      // retire any previously-published version of the same slug → only one live version
      for (const prior of await this.repo.publishedForUpdate(tx, tenantId, page.slug, id)) { prior.archive(); await this.repo.update(tx, prior, tenantId); await this.flush(tx, tenantId, prior.id, prior.pullEvents()); }
      page.publish();
      await this.repo.update(tx, page, tenantId);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'cms.page_published', entityType: 'cms_page', entityId: id, newValue: { slug: page.slug, version: page.version }, ip });
      await this.flush(tx, tenantId, id, page.pullEvents());
      return page.toJSON();
    }, { userId: actor.userId });
  }
  async archive(tenantId: string, actor: CmsActor, id: string, ip: string | null) {
    if (!actor.canManage) throw new CmsForbiddenError('requires cms.manage');
    return this.uow.run(tenantId, async (tx) => {
      const page = await this.repo.getForUpdate(tx, tenantId, id);
      if (!page) throw new PageNotFoundError(id);
      page.archive();
      await this.repo.update(tx, page, tenantId);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'cms.page_archived', entityType: 'cms_page', entityId: id, ip });
      await this.flush(tx, tenantId, id, page.pullEvents());
      return page.toJSON();
    }, { userId: actor.userId });
  }
  /** Public: serve the live page for a slug. */
  async getBySlug(tenantId: string, slug: string) {
    const p = await this.repo.publishedBySlug(tenantId, slug);
    if (!p) throw new PageNotFoundError(slug);
    return p.toJSON();
  }
  async getById(tenantId: string, actor: CmsActor, id: string) {
    if (!actor.canManage) throw new CmsForbiddenError('requires cms.manage');
    const p = await this.repo.getById(tenantId, id);
    if (!p) throw new PageNotFoundError(id);
    return p.toJSON();
  }
  async list(tenantId: string, actor: CmsActor, q: { pageKind?: string; status?: string; slug?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (!actor.canManage) throw new CmsForbiddenError('requires cms.manage');
    const rows = await this.repo.listFor(tenantId, q);
    const items = rows.map((p) => p.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'cms_page', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
