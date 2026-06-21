// apps/admin-api/src/modules/providers-ops/services/integration-providers-admin.service.ts · the registry: list/get
// providers (each with credential-ref health counts), the ENABLE/DISABLE toggle (the one consequential write,
// Law 12 — pull a failing provider out of rotation platform-wide), and the change history. One ACID tx per write;
// the toggle writes a provider_changes row + an append-only audit_log row IN THE SAME TX (§4). Never returns
// secret material — only counts.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { ProvidersRepository, ProviderListQuery, ChangeListQuery } from '../repositories/providers.repository';
import { ProviderNotFoundError } from '../domain/providers-ops.errors';
import { ToggleProviderDto } from '../dto/providers-ops.dto';

@Injectable()
export class IntegrationProvidersAdminService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: ProvidersRepository) {}

  async list(q: ProviderListQuery) {
    const [providers, health] = await Promise.all([this.repo.listProviders(q), this.repo.credentialHealthAll()]);
    const items = providers.map((p) => ({ ...p.toJSON(), health: health[p.code] ?? { configuredTenants: 0, activeTenants: 0 } }));
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(String(last.code)).toString('base64') : null;
    return { items, nextCursor };
  }

  async get(code: string) {
    const p = await this.repo.getProvider(code);
    if (!p) throw new ProviderNotFoundError(code);
    return { ...p.toJSON(), health: await this.repo.credentialHealthFor(code) };
  }

  async toggle(actor: AdminRequestContext, code: string, dto: ToggleProviderDto) {
    return this.pool.withTx(async (client) => {
      const provider = await this.repo.getProviderForUpdate(client, code);
      if (!provider) throw new ProviderNotFoundError(code);
      const change = dto.action === 'enable' ? provider.enable() : provider.disable();   // throws ProviderAlreadyInStateError on no-op
      await this.repo.updateActive(client, code, provider.isActive, actor.userId);
      await this.repo.insertChange(client, { providerCode: code, action: change.action, oldValue: change.oldValue, newValue: change.newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `providers.${change.action}`, entityType: 'integration_provider', entityId: code,
        oldValue: change.oldValue, newValue: change.newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return provider.toJSON();
    });
  }

  async history(q: ChangeListQuery) {
    if (!(await this.repo.getProvider(q.providerCode))) throw new ProviderNotFoundError(q.providerCode);
    const items = await this.repo.listChanges(q);
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
}
