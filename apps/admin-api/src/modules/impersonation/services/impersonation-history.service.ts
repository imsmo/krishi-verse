// apps/admin-api/src/modules/impersonation/services/impersonation-history.service.ts · the AUDIT surface: list
// grants (keyset, filterable by admin/target/status), read a single grant, list the actions taken under a grant,
// and RECORD an action (the exhaustive per-action log). recordAction is the canonical writer the honouring apps/api
// calls for every request made under an act-as token — it refuses to log against a missing / non-active / expired
// grant (so a stale token can't keep writing). All reads are keyset (never OFFSET), bounded.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ImpersonationRepository, GrantListQuery, ActionListQuery } from '../repositories/impersonation.repository';
import { GrantNotFoundError } from '../domain/impersonation.errors';
import { RecordActionDto } from '../dto/impersonation.dto';

@Injectable()
export class ImpersonationHistoryService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ImpersonationRepository) {}

  async listGrants(q: GrantListQuery) {
    const items = (await this.repo.listGrants(q)).map((g) => g.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  async getGrant(id: string) {
    const grant = await this.repo.getGrant(id);
    if (!grant) throw new GrantNotFoundError(id);
    return grant.toJSON();
  }

  async listActions(q: ActionListQuery) {
    if (!(await this.repo.getGrant(q.grantId))) throw new GrantNotFoundError(q.grantId);
    const items = await this.repo.listActions(q);
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  /** Record ONE action performed under a grant. The operator may only record against their OWN active, unexpired
   *  grant — a stale/closed/other grant is refused (no log injection, no writing past the time-box). */
  async recordAction(actor: AdminRequestContext, grantId: string, dto: RecordActionDto) {
    return this.pool.withTx(async (client) => {
      const grant = await this.repo.getGrantForUpdate(client, grantId);
      if (!grant) throw new GrantNotFoundError(grantId);
      const p = grant.toJSON();
      if (p.adminUserId !== actor.userId || p.status !== 'active' || grant.isExpired(new Date())) throw new GrantNotFoundError(grantId);  // 404, not 403 — don't reveal others' grants
      const row = await this.repo.insertAction(client, { grantId, targetTenantId: p.targetTenantId, method: dto.method, path: dto.path, action: dto.action ?? null });
      return { id: row.id, grantId, method: dto.method, path: dto.path, action: dto.action ?? null, createdAt: row.createdAt };
    });
  }
}
