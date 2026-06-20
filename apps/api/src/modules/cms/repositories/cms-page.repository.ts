// modules/cms/repositories/cms-page.repository.ts · cms_pages. tenant_id in every query (Law 1) + RLS (NULL
// tenant = platform page, visible to all, admin-only via Law 11). No optimistic-lock column → mutations lock
// FOR UPDATE. maxVersion backs new-version minting; publishedBySlug serves the live page; keyset admin lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { CmsPage } from '../domain/cms-page.entity';
import { PageKind, PageStatus } from '../domain/cms.events';

const COLS = `id, tenant_id, slug, page_kind, default_title, body, version, status, published_at, created_at`;
function toDomain(r: any): CmsPage {
  return CmsPage.rehydrate({ id: r.id, tenantId: r.tenant_id, slug: r.slug, pageKind: r.page_kind as PageKind, defaultTitle: r.default_title,
    body: r.body, version: r.version, status: r.status as PageStatus, publishedAt: r.published_at, createdAt: r.created_at });
}
export interface PageListQuery { pageKind?: string; status?: string; slug?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class CmsPageRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, p: CmsPage, tenantId: string | null, createdBy: string): Promise<void> {
    const v = p.toProps();
    await tx.query(`INSERT INTO cms_pages (id, tenant_id, slug, page_kind, default_title, body, version, status, published_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [v.id, tenantId, v.slug, v.pageKind, v.defaultTitle, v.body, v.version, v.status, v.publishedAt, createdBy]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<CmsPage | null> {
    const r = await tx.query(`SELECT ${COLS} FROM cms_pages WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<CmsPage | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM cms_pages WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Highest existing version for a slug in this tenant (0 if none) — backs new-version minting. */
  async maxVersion(tx: TxContext, tenantId: string, slug: string): Promise<number> {
    const r = await tx.query(`SELECT COALESCE(MAX(version),0) v FROM cms_pages WHERE tenant_id=$1 AND slug=$2`, [tenantId, slug]);
    return Number(r.rows[0]?.v ?? 0);
  }
  /** The currently-published row of the previous version of a slug, locked (to archive on a new publish). */
  async publishedForUpdate(tx: TxContext, tenantId: string, slug: string, exceptId: string): Promise<CmsPage[]> {
    const r = await tx.query(`SELECT ${COLS} FROM cms_pages WHERE tenant_id=$1 AND slug=$2 AND status='published' AND id<>$3 AND deleted_at IS NULL FOR UPDATE`, [tenantId, slug, exceptId]);
    return r.rows.map(toDomain);
  }
  async update(tx: TxContext, p: CmsPage, tenantId: string): Promise<void> {
    const v = p.toProps();
    await tx.query(`UPDATE cms_pages SET page_kind=$3, default_title=$4, body=$5, status=$6, published_at=$7, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      [v.id, tenantId, v.pageKind, v.defaultTitle, v.body, v.status, v.publishedAt]);
  }
  /** The live page for a slug (highest published version). Public read; includes platform pages. */
  async publishedBySlug(tenantId: string, slug: string): Promise<CmsPage | null> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM cms_pages WHERE (tenant_id=$1 OR tenant_id IS NULL) AND slug=$2 AND status='published' AND deleted_at IS NULL ORDER BY version DESC LIMIT 1`, [tenantId, slug]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listFor(tenantId: string, q: PageListQuery): Promise<CmsPage[]> {
    const params: unknown[] = [tenantId]; let where = `(tenant_id=$1 OR tenant_id IS NULL) AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.pageKind) where += ` AND page_kind=${p(q.pageKind)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.slug) where += ` AND slug=${p(q.slug)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM cms_pages WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
