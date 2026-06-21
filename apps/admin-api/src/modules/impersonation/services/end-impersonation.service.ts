// apps/admin-api/src/modules/impersonation/services/end-impersonation.service.ts · close an active act-as session:
// `end` (the operator finished) or `revoke` (oversight/security pulled it). One ACID tx: lock the grant FOR UPDATE
// → state machine transition (active→ended|revoked; closing an already-closed grant throws) → UPDATE → audit_log
// row, atomic (§4). Closing the grant invalidates its token server-side (the honouring API checks grant status by
// jti); the short TTL is the backstop. Idempotency: re-ending a closed grant is rejected (409), never silent.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ImpersonationRepository } from '../repositories/impersonation.repository';
import { GrantNotFoundError } from '../domain/impersonation.errors';

@Injectable()
export class EndImpersonationService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ImpersonationRepository) {}

  end(actor: AdminRequestContext, id: string, reason: string) { return this.close(actor, id, reason, 'end'); }
  revoke(actor: AdminRequestContext, id: string, reason: string) { return this.close(actor, id, reason, 'revoke'); }

  private async close(actor: AdminRequestContext, id: string, reason: string, kind: 'end' | 'revoke') {
    return this.pool.withTx(async (client) => {
      const grant = await this.repo.getGrantForUpdate(client, id);
      if (!grant) throw new GrantNotFoundError(id);
      const before = grant.status;
      const change = kind === 'end' ? grant.end(actor.userId, reason) : grant.revoke(actor.userId, reason);   // throws on illegal transition
      await this.repo.closeGrant(client, id, change.to, actor.userId, reason, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `impersonation.${change.to}`, entityType: 'impersonation_grant', entityId: id,
        oldValue: { status: before }, newValue: { status: change.to }, reason, ip: actor.ip, requestId: actor.requestId || null });
      return grant.toJSON();
    });
  }
}
