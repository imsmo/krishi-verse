// modules/tenancy/repositories/tenant-feature.repository.ts · READ-ONLY SQL for tenant_features (0002). tenant_id
// in every query (Law 1) + RLS. Self-serve only READS its effective overrides — writes are god-mode (admin-api).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TenantFeature } from '../domain/tenant-feature.entity';

@Injectable()
export class TenantFeatureRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** All per-tenant feature overrides (bounded). */
  async listFor(tenantId: string, limit = 500): Promise<TenantFeature[]> {
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT tenant_id, feature_code, is_enabled, reason, expires_at FROM tenant_features WHERE tenant_id=$1 ORDER BY feature_code LIMIT $2`, [tenantId, limit]);
    return r.rows.map((x: any) => TenantFeature.rehydrate({ tenantId: x.tenant_id, featureCode: x.feature_code, isEnabled: x.is_enabled, reason: x.reason, expiresAt: x.expires_at }));
  }
}
