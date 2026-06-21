// apps/admin-api/src/modules/flags-ops/services/global-flags.service.ts · the flag REGISTRY: create a flag + read
// the registry / a single flag / a flag's change history. A new flag is created **OFF** (is_enabled=false, Law 10
// — every feature behind a flag, default off). One ACID tx per write; the create writes a feature_flag_changes
// row + an append-only audit_log row IN THE SAME TX (§4). Reads are keyset (never OFFSET), bounded.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { FlagsRepository, FlagListQuery, ChangeListQuery } from '../repositories/flags.repository';
import { FlagNotFoundError } from '../domain/flags-ops.errors';
import { assertFlagKey, assertRolloutPct, buildTargeting } from '../domain/rollout';
import { CreateFlagDto } from '../dto/flags-ops.dto';

@Injectable()
export class GlobalFlagsService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: FlagsRepository) {}

  async create(actor: AdminRequestContext, dto: CreateFlagDto) {
    assertFlagKey(dto.key);
    assertRolloutPct(dto.rolloutPct);
    const rules = buildTargeting({ tenantIds: dto.tenantIds, plans: dto.plans, countries: dto.countries });
    return this.pool.withTx(async (client) => {
      const flag = await this.repo.createFlag(client, { key: dto.key, description: dto.description ?? null, rolloutPct: dto.rolloutPct, rules, actorUserId: actor.userId });
      const created = flag.toJSON();
      await this.repo.insertChange(client, { flagKey: dto.key, action: 'created', oldValue: null, newValue: created, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: 'flags.created', entityType: 'feature_flag', entityId: dto.key,
        newValue: { rolloutPct: dto.rolloutPct, isEnabled: false }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return created;
    });
  }

  async list(q: FlagListQuery) {
    const items = (await this.repo.listFlags(q)).map((f) => f.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.key}`).toString('base64') : null;
    return { items, nextCursor };
  }

  async get(key: string) {
    const flag = await this.repo.getFlag(key);
    if (!flag) throw new FlagNotFoundError(key);
    return flag.toJSON();
  }

  async history(q: ChangeListQuery) {
    // 404 if the flag doesn't exist, so a typo doesn't silently return an empty timeline.
    if (!(await this.repo.getFlag(q.flagKey))) throw new FlagNotFoundError(q.flagKey);
    const items = await this.repo.listChanges(q);
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
