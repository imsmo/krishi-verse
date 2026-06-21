// apps/admin-api/src/modules/flags-ops/services/kill-switch.service.ts · the on/off + EMERGENCY KILL-SWITCH
// (Law 10). enable/disable flip is_enabled; kill disables AND locks (no re-enable until unlock); unlock releases
// the lock (does NOT re-enable). One ACID tx per write: lock the flag FOR UPDATE → entity guard (a locked flag
// refuses enable) → UPDATE feature_flags → feature_flag_changes row → audit_log row, all atomic (§4). Each change
// propagates to every node within the runtime evaluator's cache TTL (seconds).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { FlagsRepository } from '../repositories/flags.repository';
import { FeatureFlag, ChangeRecord } from '../domain/flag.entity';
import { FlagNotFoundError } from '../domain/flags-ops.errors';

@Injectable()
export class KillSwitchService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: FlagsRepository) {}

  enable(actor: AdminRequestContext, key: string, reason: string) { return this.mutate(actor, key, reason, (f) => f.enable()); }
  disable(actor: AdminRequestContext, key: string, reason: string) { return this.mutate(actor, key, reason, (f) => f.disable()); }
  kill(actor: AdminRequestContext, key: string, reason: string) { return this.mutate(actor, key, reason, (f) => f.kill()); }
  unlock(actor: AdminRequestContext, key: string, reason: string) { return this.mutate(actor, key, reason, (f) => f.unlock()); }

  /** Shared one-ACID-tx mutate: lock → guard (throws) → persist → history + audit IN THE SAME TX. */
  private async mutate(actor: AdminRequestContext, key: string, reason: string, apply: (f: FeatureFlag) => ChangeRecord) {
    return this.pool.withTx(async (client) => {
      const flag = await this.repo.getFlagForUpdate(client, key);
      if (!flag) throw new FlagNotFoundError(key);
      const change = apply(flag);                                  // throws FlagLockedError / FlagNotLockedError
      await this.repo.updateFlag(client, flag, actor.userId);
      await this.repo.insertChange(client, { flagKey: key, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `flags.${change.action}`, entityType: 'feature_flag', entityId: key,
        oldValue: change.oldValue, newValue: change.newValue, reason, ip: actor.ip, requestId: actor.requestId || null });
      return flag.toJSON();
    });
  }
}
