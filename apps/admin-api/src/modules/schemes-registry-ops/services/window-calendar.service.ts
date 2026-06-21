// apps/admin-api/src/modules/schemes-registry-ops/services/window-calendar.service.ts · the application-window
// surface: setWindow (WHEN a scheme accepts applications) + a read-only CALENDAR (which active schemes are open on
// a given 'MM-DD', year-wrap aware). Setting the window does NOT bump schemes.version (it's operational, not an
// eligibility/entitlement change — already-submitted applications are unaffected). One ACID tx per write: lock
// FOR UPDATE → entity.setWindow → UPDATE → an 'updated' scheme_registry_changes row → an audit_log row, atomic.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { SchemesRegistryRepository, CalendarQuery } from '../repositories/schemes-registry.repository';
import { SchemeNotFoundError } from '../domain/schemes-registry.errors';
import { SetWindowDto } from '../dto/schemes-registry.dto';

const tsCursor = (createdAt: any, id: string) => Buffer.from(`${createdAt?.toISOString?.() ?? createdAt}|${id}`).toString('base64');
/** Today's 'MM-DD' in UTC — the default calendar date when none is supplied. */
function todayMmDd(): string { const d = new Date(); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }

@Injectable()
export class WindowCalendarService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: SchemesRegistryRepository) {}

  async setWindow(actor: AdminRequestContext, id: string, dto: SetWindowDto) {
    return this.pool.withTx(async (client) => {
      const scheme = await this.repo.getSchemeForUpdate(client, id);
      if (!scheme) throw new SchemeNotFoundError(id);
      const change = scheme.setWindow(dto.applicationWindow);   // validates MM-DD + season; throws SchemeAlreadyInState on no-op
      await this.repo.updateSchemeWindow(client, id, scheme.persist.applicationWindow, actor.userId);
      await this.repo.insertChange(client, { entityType: 'scheme', entityId: id, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'schemes.scheme.window_set', entityType: 'scheme', entityId: id, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return scheme.toJSON();
    });
  }

  /** Active schemes whose application_window is open on `onDate` ('MM-DD', defaults to today, UTC). */
  async calendar(q: { onDate?: string; cursor?: { c: string; id: string }; limit: number }) {
    const onDate = q.onDate ?? todayMmDd();
    const query: CalendarQuery = { onDate, cursor: q.cursor, limit: q.limit };
    const items = (await this.repo.schemesOpenOn(query)).map((s) => s.toJSON());
    const last = items[items.length - 1];
    return { onDate, items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
}
