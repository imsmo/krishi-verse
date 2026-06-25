// modules/tenant-integrations/repositories/tenant-integration.repository.ts · SQL for tenant_integrations (0002) +
// the GLOBAL integration_providers catalogue. tenant_id in EVERY tenant_integrations query (Law 1) + RLS. Reads on
// the replica; writes through the tx. secret_ref is written but NEVER selected into a response shape.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { TenantIntegration } from '../domain/tenant-integration.entity';

export interface ProviderRow { code: string; defaultName: string; category: string; isActive: boolean; }

@Injectable()
export class TenantIntegrationRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** The GLOBAL provider catalogue (active only), bounded. */
  async listProviders(tenantId: string, limit = 200): Promise<ProviderRow[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT code, default_name, category, is_active FROM integration_providers WHERE is_active = true ORDER BY category, code LIMIT $1`, [limit]);
    return r.rows.map((x: any) => ({ code: x.code, defaultName: x.default_name, category: x.category, isActive: x.is_active }));
  }

  /** The tenant's own integrations joined to provider names (masked at the entity — never selects nothing secret extra). */
  async listForTenant(tenantId: string, limit = 200): Promise<TenantIntegration[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ti.id, ti.tenant_id, ti.provider_code, ti.secret_ref, ti.config, ti.is_active, ti.created_at,
              p.default_name AS provider_name, p.category
         FROM tenant_integrations ti
         JOIN integration_providers p ON p.code = ti.provider_code
        WHERE ti.tenant_id = $1
        ORDER BY ti.provider_code LIMIT $2`, [tenantId, limit]);
    return r.rows.map((x: any) => new TenantIntegration({
      id: x.id, tenantId: x.tenant_id, providerCode: x.provider_code, secretRef: x.secret_ref,
      config: x.config ?? {}, isActive: x.is_active, providerName: x.provider_name, category: x.category,
      createdAt: x.created_at ? new Date(x.created_at).toISOString() : null,
    }));
  }

  async providerExists(tx: TxContext, providerCode: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM integration_providers WHERE code = $1 AND is_active = true`, [providerCode]);
    return r.rows.length > 0;
  }

  /** Find the existing secret_ref for a (tenant, provider) — used to clean up the old vault entry on reconnect. */
  async findSecretRef(tx: TxContext, tenantId: string, providerCode: string): Promise<string | null> {
    const r = await tx.query(`SELECT secret_ref FROM tenant_integrations WHERE tenant_id = $1 AND provider_code = $2`, [tenantId, providerCode]);
    return r.rows[0]?.secret_ref ?? null;
  }

  /** Upsert the integration row with the freshly-stored vault ref (one per tenant+provider). */
  async upsert(tx: TxContext, tenantId: string, providerCode: string, secretRef: string, config: Record<string, unknown>): Promise<string> {
    const r = await tx.query(
      `INSERT INTO tenant_integrations (tenant_id, provider_code, secret_ref, config, is_active, created_at)
       VALUES ($1,$2,$3,$4::jsonb, true, now())
       ON CONFLICT (tenant_id, provider_code)
       DO UPDATE SET secret_ref = EXCLUDED.secret_ref, config = EXCLUDED.config, is_active = true, updated_at = now()
       RETURNING id`, [tenantId, providerCode, secretRef, JSON.stringify(config ?? {})]);
    return r.rows[0].id;
  }

  async deactivate(tx: TxContext, tenantId: string, providerCode: string): Promise<boolean> {
    const r = await tx.query(
      `UPDATE tenant_integrations SET is_active = false, updated_at = now()
        WHERE tenant_id = $1 AND provider_code = $2 AND is_active = true`, [tenantId, providerCode]);
    return (r.rowCount ?? 0) > 0;
  }
}
