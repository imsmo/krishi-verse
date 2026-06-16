// core/rbac/role-cache.service.ts
// DB-backed RBAC resolution — the AUTHORITY for what a user can do. Effective
// permissions = (perms of the user's active roles in the tenant)  ∪ (per-staff
// GRANT overrides)  −  (per-staff DENY overrides). super_admin additionally gets '*'.
// Resolved from the database (role_permissions + staff_permission_overrides), never
// trusted from the client. Cached (default 5 min) and explicitly invalidated when a
// user's roles/overrides change, so a token minted after a change reflects it.
import { Inject, Injectable } from '@nestjs/common';
import { PgPoolProvider } from '../database/pg-pool.provider';
import { ShardRouter } from '../sharding/shard-router';
import { CACHE_SERVICE, CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache-keys';

export interface EffectiveAccess { roles: string[]; permissions: string[]; }
const TTL_SECONDS = 300;

@Injectable()
export class RoleCacheService {
  constructor(
    private readonly pools: PgPoolProvider,
    private readonly shards: ShardRouter,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async effectiveAccess(userId: string, tenantId: string): Promise<EffectiveAccess> {
    return this.cache.wrap(CacheKeys.effectivePerms(tenantId, userId), TTL_SECONDS, () =>
      this.resolveFromDb(userId, tenantId));
  }

  /** Call after any change to a user's roles/overrides in a tenant. */
  async invalidate(userId: string, tenantId: string): Promise<void> {
    await this.cache.del(CacheKeys.effectivePerms(tenantId, userId));
  }

  private async resolveFromDb(userId: string, tenantId: string): Promise<EffectiveAccess> {
    const pool = this.pools.replica(this.shards.shardFor(tenantId));
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

      const rolesRes = await client.query(
        `SELECT r.code
           FROM user_tenant_roles utr JOIN roles r ON r.id = utr.role_id
          WHERE utr.user_id = $1 AND utr.tenant_id = $2 AND utr.is_active AND utr.deleted_at IS NULL`,
        [userId, tenantId],
      );
      const roles = rolesRes.rows.map((r) => r.code);

      const permRes = await client.query(
        `WITH active AS (
           SELECT utr.id AS utr_id, utr.role_id
           FROM user_tenant_roles utr
           WHERE utr.user_id = $1 AND utr.tenant_id = $2 AND utr.is_active AND utr.deleted_at IS NULL
         ),
         base AS (
           SELECT rp.permission_code AS code FROM role_permissions rp
           JOIN active a ON a.role_id = rp.role_id
         ),
         grants AS (
           SELECT spo.permission_code AS code FROM staff_permission_overrides spo
           JOIN active a ON a.utr_id = spo.user_tenant_role_id WHERE spo.is_granted
         ),
         denies AS (
           SELECT spo.permission_code AS code FROM staff_permission_overrides spo
           JOIN active a ON a.utr_id = spo.user_tenant_role_id WHERE NOT spo.is_granted
         )
         SELECT DISTINCT code FROM (
           SELECT code FROM base UNION SELECT code FROM grants
         ) u WHERE code NOT IN (SELECT code FROM denies)`,
        [userId, tenantId],
      );
      await client.query('COMMIT');

      const permissions = permRes.rows.map((r) => r.code);
      // NOTE: god-mode ('*') is intentionally NOT granted here. Platform/owner power
      // lives ONLY in apps/admin-api (separate auth realm, FIDO2 — CLAUDE.md Law 11).
      // The tenant API never resolves a wildcard, so a mis-assigned platform role
      // cannot become god-mode through this path.
      return { roles, permissions };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
}
export const ROLE_CACHE_SERVICE = Symbol('ROLE_CACHE_SERVICE');
