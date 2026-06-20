// modules/cms/repositories/banner.repository.ts · banners. tenant_id in every query (Law 1) + RLS. No version →
// mutations lock FOR UPDATE. The `live` list bounds on is_active + the [starts_at, ends_at) window; click_count
// is incremented atomically (UPDATE … +1) to avoid a read-modify-write race. Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { Banner } from '../domain/banner.entity';

const COLS = `id, tenant_id, placement, media_id, language_code, target_url, audience_rules, starts_at, ends_at, click_count, is_active, created_at`;
function toDomain(r: any): Banner {
  return Banner.rehydrate({ id: r.id, tenantId: r.tenant_id, placement: r.placement, mediaId: r.media_id, languageCode: r.language_code, targetUrl: r.target_url,
    audienceRules: r.audience_rules ?? {}, startsAt: r.starts_at, endsAt: r.ends_at, clickCount: r.click_count, isActive: r.is_active, createdAt: r.created_at });
}
export interface BannerListQuery { box: 'live' | 'all'; placement?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class BannerRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, b: Banner, createdBy: string): Promise<void> {
    const p = b.toProps();
    await tx.query(`INSERT INTO banners (id, tenant_id, placement, media_id, language_code, target_url, audience_rules, starts_at, ends_at, click_count, is_active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
      [p.id, p.tenantId, p.placement, p.mediaId, p.languageCode, p.targetUrl, JSON.stringify(p.audienceRules), p.startsAt, p.endsAt, p.clickCount, p.isActive, createdBy]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<Banner | null> {
    const r = await tx.query(`SELECT ${COLS} FROM banners WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<Banner | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM banners WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, b: Banner, tenantId: string): Promise<void> {
    const p = b.toProps();
    await tx.query(`UPDATE banners SET is_active=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, tenantId, p.isActive]);
  }
  /** Atomic click increment (no read-modify-write race). Bounded by id + tenant. */
  async incrementClick(tx: TxContext, tenantId: string, id: string): Promise<boolean> {
    const r = await tx.query(`UPDATE banners SET click_count = click_count + 1, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [id, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }
  async listFor(tenantId: string, q: BannerListQuery): Promise<Banner[]> {
    const params: unknown[] = [tenantId]; let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.box === 'live') where += ` AND is_active=true AND starts_at <= now() AND ends_at > now()`;
    if (q.placement) where += ` AND placement=${p(q.placement)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM banners WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
