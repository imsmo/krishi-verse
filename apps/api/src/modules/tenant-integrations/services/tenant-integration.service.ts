// modules/tenant-integrations/services/tenant-integration.service.ts · the tenant's own third-party integrations.
// connect: the raw credential goes to the vault (SecretWriter) and ONLY the opaque ref is persisted (Law: never
// store raw provider secrets); one ACID tx; audited (no secret in the audit). disconnect: deactivate + best-effort
// vault delete. All reads tenant-scoped (Law 1) + RLS. RBAC THROWS (tenant.settings). Metric + timing per use-case.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { SECRET_WRITER, SecretWriter } from '../../../core/secrets/secret-writer.port';
import { TenantIntegrationRepository } from '../repositories/tenant-integration.repository';
import { ConnectIntegrationDto } from '../dto/connect-integration.dto';
import { IntegrationsForbiddenError, IntegrationNotFoundError, ProviderNotFoundError } from '../domain/tenant-integrations.errors';

export interface IntegrationsActor { userId: string; canManage: boolean; }

@Injectable()
export class TenantIntegrationService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(SECRET_WRITER) private readonly secrets: SecretWriter,
    private readonly audit: AuditWriter,
    private readonly repo: TenantIntegrationRepository,
  ) {}

  private assertManager(a: IntegrationsActor) { if (!a.canManage) throw new IntegrationsForbiddenError(); }

  listProviders(tenantId: string) {
    return timed(this.metrics, 'tenant_integrations.providers', { tenant: tenantId }, () => this.repo.listProviders(tenantId));
  }

  list(tenantId: string) {
    return timed(this.metrics, 'tenant_integrations.list', { tenant: tenantId }, async () => {
      const rows = await this.repo.listForTenant(tenantId);
      return rows.map((r) => r.serialize());
    });
  }

  /** Connect/replace a provider's credentials. The secret is vaulted FIRST; only the ref is persisted. */
  async connect(tenantId: string, actor: IntegrationsActor, dto: ConnectIntegrationDto, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'tenant_integrations.connect', { tenant: tenantId }, async () => {
      // Vault the raw credential outside the tx (external call); store ONLY the returned ref.
      const { secretRef } = await this.secrets.putTenantSecret(tenantId, dto.providerCode, dto.credential);
      let oldRef: string | null = null;
      const id = await this.uow.run(tenantId, async (tx) => {
        if (!(await this.repo.providerExists(tx, dto.providerCode))) throw new ProviderNotFoundError(dto.providerCode);
        oldRef = await this.repo.findSecretRef(tx, tenantId, dto.providerCode);
        const newId = await this.repo.upsert(tx, tenantId, dto.providerCode, secretRef, dto.config ?? {});
        await this.audit.write(tx, {
          tenantId, actorUserId: actor.userId, action: 'integration.connected',
          entityType: 'tenant_integration', entityId: newId,
          newValue: { providerCode: dto.providerCode, config: dto.config ?? {} }, ip, // NO credential/secretRef
        });
        return newId;
      }, { userId: actor.userId });
      if (oldRef && oldRef !== secretRef) await this.secrets.deleteTenantSecret(oldRef).catch(() => undefined);
      return { id, providerCode: dto.providerCode, connected: true };
    });
  }

  async disconnect(tenantId: string, actor: IntegrationsActor, providerCode: string, ip: string | null) {
    this.assertManager(actor);
    return timed(this.metrics, 'tenant_integrations.disconnect', { tenant: tenantId }, async () => {
      let oldRef: string | null = null;
      const ok = await this.uow.run(tenantId, async (tx) => {
        oldRef = await this.repo.findSecretRef(tx, tenantId, providerCode);
        const deactivated = await this.repo.deactivate(tx, tenantId, providerCode);
        if (!deactivated) throw new IntegrationNotFoundError(providerCode);
        await this.audit.write(tx, {
          tenantId, actorUserId: actor.userId, action: 'integration.disconnected',
          entityType: 'tenant_integration', entityId: providerCode, ip,
        });
        return true;
      }, { userId: actor.userId });
      if (oldRef) await this.secrets.deleteTenantSecret(oldRef).catch(() => undefined);
      return { providerCode, connected: false, ok };
    });
  }
}
