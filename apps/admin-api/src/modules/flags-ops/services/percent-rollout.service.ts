// apps/admin-api/src/modules/flags-ops/services/percent-rollout.service.ts · gradual-rollout controls: set the
// deterministic percentage (0..100) and the targeting allowlist (tenant_ids/plans/countries — the snake_case
// shape the runtime evaluator reads). One ACID tx per write: lock the flag FOR UPDATE → entity guard (a locked
// flag refuses these) → UPDATE feature_flags → feature_flag_changes row → audit_log row, atomic (§4). Targeting
// is validated + bounded in the domain (abuse/DoS guard). Moves no money; toggles no kill-switch.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { FlagsRepository } from '../repositories/flags.repository';
import { FeatureFlag, ChangeRecord } from '../domain/flag.entity';
import { FlagNotFoundError } from '../domain/flags-ops.errors';
import { buildTargeting } from '../domain/rollout';

@Injectable()
export class PercentRolloutService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: FlagsRepository) {}

  setRollout(actor: AdminRequestContext, key: string, pct: number, reason: string) {
    return this.mutate(actor, key, reason, (f) => f.setRollout(pct));     // entity asserts 0..100 + not locked
  }

  setTargeting(actor: AdminRequestContext, key: string, input: { tenantIds: string[]; plans: string[]; countries: string[] }, reason: string) {
    const rules = buildTargeting(input);                                  // validates + normalises to snake_case (throws on bad/oversized)
    return this.mutate(actor, key, reason, (f) => f.setTargeting(rules));
  }

  private async mutate(actor: AdminRequestContext, key: string, reason: string, apply: (f: FeatureFlag) => ChangeRecord) {
    return this.pool.withTx(async (client) => {
      const flag = await this.repo.getFlagForUpdate(client, key);
      if (!flag) throw new FlagNotFoundError(key);
      const change = apply(flag);                                         // throws FlagLockedError / InvalidRolloutError
      await this.repo.updateFlag(client, flag, actor.userId);
      await this.repo.insertChange(client, { flagKey: key, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `flags.${change.action}`, entityType: 'feature_flag', entityId: key,
        oldValue: change.oldValue, newValue: change.newValue, reason, ip: actor.ip, requestId: actor.requestId || null });
      return flag.toJSON();
    });
  }
}
