// apps/admin-api/src/modules/providers-ops/services/provider-sla-monitor.service.ts · READ-ONLY provider-health
// monitor: every provider with its credential-ref coverage (configured / active tenant counts) + registry status,
// flagging a **degraded** state = the provider is DISABLED but tenants still point at it (those integrations will
// fail until re-enabled or migrated). Counts only — never secret material. NOTE: live uptime / circuit-breaker
// state is owned by core/resilience + observability at runtime; this surface reports the PERSISTED configuration
// health, not real-time latency (which this plane has no source for).
import { Injectable } from '@nestjs/common';
import { ProvidersRepository } from '../repositories/providers.repository';

@Injectable()
export class ProviderSlaMonitorService {
  constructor(private readonly repo: ProvidersRepository) {}

  async healthRollup() {
    const [providers, health] = await Promise.all([this.repo.listAll(), this.repo.credentialHealthAll()]);
    const items = providers.map((p) => {
      const h = health[p.code] ?? { configuredTenants: 0, activeTenants: 0 };
      const j = p.toJSON();
      return { ...j, health: h, degraded: !j.isActive && h.configuredTenants > 0 };   // disabled but still referenced
    });
    // most-configured first, degraded surfaced
    items.sort((a, b) => Number(b.degraded) - Number(a.degraded) || b.health.configuredTenants - a.health.configuredTenants);
    return { items };
  }
}
