// apps/admin-api/src/modules/announcements/services/announcement-crud.service.ts · author + run platform-wide
// announcements. create (draft) → update (draft/scheduled) → schedule → publish → expire/archive, each through the
// state machine (Law 5). One ACID tx per write: the change + an announcement_changes row + an append-only
// audit_log row commit atomically (§4). Text is PLAIN TEXT (assertPlainText — no HTML/stored-XSS); audience +
// schedule windows are validated/bounded in the domain. Reads: list, single, currently-live, history.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { AnnouncementsRepository, AnnouncementListQuery, ChangeListQuery } from '../repositories/announcements.repository';
import { Announcement, AnnouncementChange } from '../domain/announcement.entity';
import { AnnouncementNotFoundError } from '../domain/announcements.errors';
import { assertPlainText, buildAudience, assertWindow } from '../domain/content';
import { CreateAnnouncementDto, UpdateAnnouncementDto, ScheduleAnnouncementDto, PublishAnnouncementDto } from '../dto/announcements.dto';

const ACTIVE_LIMIT = 100;

@Injectable()
export class AnnouncementCrudService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: AnnouncementsRepository) {}

  async create(actor: AdminRequestContext, dto: CreateAnnouncementDto) {
    const title = assertPlainText(dto.title, 'title', 200);
    const body = assertPlainText(dto.body, 'body', 4000);
    const audience = buildAudience({ plans: dto.plans, countries: dto.countries });
    const id = randomUUID();
    return this.pool.withTx(async (client) => {
      const created = (await this.repo.insert(client, { id, title, body, severity: dto.severity, placement: dto.placement, audience, actorUserId: actor.userId })).toJSON();
      await this.repo.insertChange(client, { announcementId: id, action: 'created', oldValue: null, newValue: { title, severity: dto.severity }, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'announcements.created', entityType: 'platform_announcement', entityId: id, newValue: { title, severity: dto.severity, status: 'draft' }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return created;
    });
  }

  async update(actor: AdminRequestContext, id: string, dto: UpdateAnnouncementDto) {
    const title = assertPlainText(dto.title, 'title', 200);
    const body = assertPlainText(dto.body, 'body', 4000);
    const audience = buildAudience({ plans: dto.plans, countries: dto.countries });
    return this.mutate(actor, id, dto.reason, (a) => a.updateContent({ title, body, severity: dto.severity, placement: dto.placement, audience }));
  }

  async schedule(actor: AdminRequestContext, id: string, dto: ScheduleAnnouncementDto) {
    const { startsAt, endsAt } = assertWindow(new Date(dto.startsAt), new Date(dto.endsAt));
    return this.mutate(actor, id, dto.reason, (a) => a.schedule(startsAt, endsAt));
  }

  async publish(actor: AdminRequestContext, id: string, dto: PublishAnnouncementDto) {
    // publish-now of an unscheduled draft requires an endsAt (validated forward + bounded); else use the schedule.
    const endsAt = dto.endsAt ? assertWindow(new Date(), new Date(dto.endsAt)).endsAt : null;
    return this.mutate(actor, id, dto.reason, (a) => a.publish(endsAt));
  }

  async expire(actor: AdminRequestContext, id: string, reason: string) { return this.mutate(actor, id, reason, (a) => a.expire()); }
  async archive(actor: AdminRequestContext, id: string, reason: string) { return this.mutate(actor, id, reason, (a) => a.archive()); }

  async list(q: AnnouncementListQuery) {
    const items = (await this.repo.listAnnouncements(q)).map((a) => a.toJSON());
    return { items, nextCursor: this.cursor(items, q.limit) };
  }
  async active() { return { items: (await this.repo.listActive(new Date(), ACTIVE_LIMIT)).map((a) => a.toJSON()) }; }
  async get(id: string) { const a = await this.repo.getAnnouncement(id); if (!a) throw new AnnouncementNotFoundError(id); return a.toJSON(); }
  async history(q: ChangeListQuery) {
    if (!(await this.repo.getAnnouncement(q.announcementId))) throw new AnnouncementNotFoundError(q.announcementId);
    const items = await this.repo.listChanges(q);
    return { items, nextCursor: this.cursor(items, q.limit) };
  }

  /** Shared one-ACID-tx mutate: lock → apply (state machine, throws) → persist → change + audit IN THE SAME TX. */
  private async mutate(actor: AdminRequestContext, id: string, reason: string, apply: (a: Announcement) => AnnouncementChange) {
    return this.pool.withTx(async (client) => {
      const a = await this.repo.getForUpdate(client, id);
      if (!a) throw new AnnouncementNotFoundError(id);
      const change = apply(a);                          // throws IllegalAnnouncementTransitionError / immutable / invalid
      await this.repo.update(client, a, actor.userId);
      await this.repo.insertChange(client, { announcementId: id, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `announcements.${change.action}`, entityType: 'platform_announcement', entityId: id,
        oldValue: change.oldValue, newValue: change.newValue, reason, ip: actor.ip, requestId: actor.requestId || null });
      return a.toJSON();
    });
  }

  private cursor(items: any[], limit: number): string | null {
    const last = items[items.length - 1];
    return items.length === limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
  }
}
