// apps/admin-api/src/modules/announcements/repositories/announcements.repository.ts · ALL SQL for announcements.
// READS: platform_announcements (keyset list + single + FOR UPDATE + the currently-live set) and
// announcement_changes (keyset history). WRITES (in the caller's tx): insert, update-from-snapshot (one UPDATE for
// every lifecycle/content change), and a change-history row. platform_announcements + announcement_changes are
// GLOBAL/god-mode (no tenant_id) — kv_admin-only, every action audited. Parameterised; keyset (never OFFSET); bounded.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { Announcement, AnnouncementProps } from '../domain/announcement.entity';
import { AnnouncementStatus } from '../domain/announcement.state';
import { Severity, Placement, Audience } from '../domain/content';

const COLS = `id, title, body, severity, placement, status, audience, starts_at, ends_at, published_at, created_at`;
function toAnnouncement(r: any): Announcement {
  const props: AnnouncementProps = {
    id: r.id, title: r.title, body: r.body, severity: r.severity as Severity, placement: r.placement as Placement,
    status: r.status as AnnouncementStatus, audience: (r.audience ?? {}) as Audience,
    startsAt: r.starts_at ?? null, endsAt: r.ends_at ?? null, publishedAt: r.published_at ?? null, createdAt: r.created_at ?? null,
  };
  return Announcement.rehydrate(props);
}

export interface AnnouncementListQuery { status?: AnnouncementStatus; severity?: Severity; cursor?: { c: string; id: string }; limit: number; }
export interface ChangeListQuery { announcementId: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly pool: AdminPool) {}

  async listAnnouncements(q: AnnouncementListQuery): Promise<Announcement[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.severity) where += ` AND severity=${p(q.severity)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${COLS} FROM platform_announcements WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toAnnouncement);
  }

  /** The currently-live notices (published + now within the window) — what the apps/api read path would surface. */
  async listActive(now: Date, limit: number): Promise<Announcement[]> {
    const r = await this.pool.query(
      `SELECT ${COLS} FROM platform_announcements
         WHERE deleted_at IS NULL AND status='published' AND starts_at <= $1 AND ends_at > $1
         ORDER BY severity DESC, starts_at DESC, id DESC LIMIT $2`, [now.toISOString(), limit]);
    return r.rows.map(toAnnouncement);
  }

  async getAnnouncement(id: string): Promise<Announcement | null> {
    const r = await this.pool.query(`SELECT ${COLS} FROM platform_announcements WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toAnnouncement(r.rows[0]) : null;
  }
  async getForUpdate(client: PoolClient, id: string): Promise<Announcement | null> {
    const r = await client.query(`SELECT ${COLS} FROM platform_announcements WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    return r.rows[0] ? toAnnouncement(r.rows[0]) : null;
  }

  async insert(client: PoolClient, a: { id: string; title: string; body: string; severity: Severity; placement: Placement; audience: Audience; actorUserId: string }): Promise<Announcement> {
    const r = await client.query(
      `INSERT INTO platform_announcements (id, title, body, severity, placement, status, audience, created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb,$7) RETURNING ${COLS}`,
      [a.id, a.title, a.body, a.severity, a.placement, JSON.stringify(a.audience), a.actorUserId]);
    return toAnnouncement(r.rows[0]);
  }

  /** Persist the entity's full snapshot (used for every content/lifecycle mutation). */
  async update(client: PoolClient, ann: Announcement, actorUserId: string): Promise<void> {
    const s = ann.snapshot();
    await client.query(
      `UPDATE platform_announcements SET title=$2, body=$3, severity=$4, placement=$5, status=$6, audience=$7::jsonb,
              starts_at=$8, ends_at=$9, published_at=$10, updated_by=$11, updated_at=now() WHERE id=$1`,
      [ann.id, s.title, s.body, s.severity, s.placement, s.status, JSON.stringify(s.audience),
       s.startsAt ? s.startsAt.toISOString() : null, s.endsAt ? s.endsAt.toISOString() : null, s.publishedAt ? s.publishedAt.toISOString() : null, actorUserId]);
  }

  async insertChange(client: PoolClient, c: { announcementId: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO announcement_changes (announcement_id, action, old_value, new_value, reason, actor_user_id) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
      [c.announcementId, c.action, c.oldValue != null ? JSON.stringify(c.oldValue) : null, c.newValue != null ? JSON.stringify(c.newValue) : null, c.reason, c.actorUserId]);
  }
  async listChanges(q: ChangeListQuery): Promise<any[]> {
    const params: unknown[] = [q.announcementId]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'announcement_id=$1';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, announcement_id, action, old_value, new_value, reason, actor_user_id, created_at FROM announcement_changes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, announcementId: x.announcement_id, action: x.action, oldValue: x.old_value ?? null, newValue: x.new_value ?? null, reason: x.reason, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }
}
