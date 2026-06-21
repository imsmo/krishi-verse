// apps/admin-api/src/modules/providers-ops/repositories/providers.repository.ts · ALL SQL for providers-ops. READS:
// integration_providers (keyset list + single + FOR UPDATE), the credential-ref HEALTH rollup over
// tenant_integrations (counts ONLY — secret_ref is NEVER selected), and provider_changes (keyset history). WRITE
// (in the caller's tx): the enable/disable toggle + a change-history row. integration_providers + provider_changes
// are GLOBAL/god-mode; tenant_integrations is cross-tenant (kv_admin bypasses RLS) but only ever COUNTED here.
// Parameterised; keyset (never OFFSET); bounded.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { IntegrationProvider, ProviderProps } from '../domain/provider.entity';
import { ProviderCategory } from '../domain/category';

const COLS = `code, default_name, category, is_active, created_at`;
function toProvider(r: any): IntegrationProvider {
  const props: ProviderProps = { code: r.code, defaultName: r.default_name, category: r.category, isActive: r.is_active, createdAt: r.created_at ?? null };
  return IntegrationProvider.rehydrate(props);
}

export interface ProviderHealth { configuredTenants: number; activeTenants: number; }
export interface ProviderListQuery { category?: ProviderCategory; isActive?: boolean; cursor?: { code: string }; limit: number; }
export interface ChangeListQuery { providerCode: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class ProvidersRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ---------------- integration_providers ---------------- */
  async listProviders(q: ProviderListQuery): Promise<IntegrationProvider[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.category) where += ` AND category=${p(q.category)}`;
    if (q.isActive !== undefined) where += ` AND is_active=${p(q.isActive)}`;
    if (q.cursor) where += ` AND code > ${p(q.cursor.code)}`;        // keyset on the PK (stable, ordered)
    const lp = p(q.limit);
    const r = await this.pool.query(`SELECT ${COLS} FROM integration_providers WHERE ${where} ORDER BY code ASC LIMIT ${lp}`, params);
    return r.rows.map(toProvider);
  }
  async listByCategories(categories: readonly string[]): Promise<IntegrationProvider[]> {
    const r = await this.pool.query(`SELECT ${COLS} FROM integration_providers WHERE deleted_at IS NULL AND category = ANY($1) ORDER BY code ASC LIMIT 200`, [categories as string[]]);
    return r.rows.map(toProvider);
  }
  async listAll(): Promise<IntegrationProvider[]> {
    const r = await this.pool.query(`SELECT ${COLS} FROM integration_providers WHERE deleted_at IS NULL ORDER BY code ASC LIMIT 500`);
    return r.rows.map(toProvider);
  }
  async getProvider(code: string): Promise<IntegrationProvider | null> {
    const r = await this.pool.query(`SELECT ${COLS} FROM integration_providers WHERE code=$1 AND deleted_at IS NULL`, [code]);
    return r.rows[0] ? toProvider(r.rows[0]) : null;
  }
  async getProviderForUpdate(client: PoolClient, code: string): Promise<IntegrationProvider | null> {
    const r = await client.query(`SELECT ${COLS} FROM integration_providers WHERE code=$1 AND deleted_at IS NULL FOR UPDATE`, [code]);
    return r.rows[0] ? toProvider(r.rows[0]) : null;
  }
  async updateActive(client: PoolClient, code: string, isActive: boolean, actorUserId: string): Promise<void> {
    await client.query(`UPDATE integration_providers SET is_active=$2, updated_by=$3, updated_at=now() WHERE code=$1`, [code, isActive, actorUserId]);
  }

  /* ---------------- credential-ref HEALTH (counts only — NEVER secret_ref) ---------------- */
  async credentialHealthAll(): Promise<Record<string, ProviderHealth>> {
    const r = await this.pool.query(
      `SELECT provider_code, COUNT(*)::int AS configured, COUNT(*) FILTER (WHERE is_active)::int AS active
         FROM tenant_integrations WHERE deleted_at IS NULL GROUP BY provider_code`);
    const out: Record<string, ProviderHealth> = {};
    for (const row of r.rows) out[row.provider_code] = { configuredTenants: row.configured ?? 0, activeTenants: row.active ?? 0 };
    return out;
  }
  async credentialHealthFor(code: string): Promise<ProviderHealth> {
    const r = await this.pool.query(
      `SELECT COUNT(*)::int AS configured, COUNT(*) FILTER (WHERE is_active)::int AS active
         FROM tenant_integrations WHERE provider_code=$1 AND deleted_at IS NULL`, [code]);
    return { configuredTenants: r.rows[0]?.configured ?? 0, activeTenants: r.rows[0]?.active ?? 0 };
  }

  /* ---------------- provider_changes (append-only history) ---------------- */
  async insertChange(client: PoolClient, c: { providerCode: string; action: string; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO provider_changes (provider_code, action, old_value, new_value, reason, actor_user_id) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
      [c.providerCode, c.action, c.oldValue != null ? JSON.stringify(c.oldValue) : null, c.newValue != null ? JSON.stringify(c.newValue) : null, c.reason, c.actorUserId]);
  }
  async listChanges(q: ChangeListQuery): Promise<any[]> {
    const params: unknown[] = [q.providerCode]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'provider_code=$1';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, provider_code, action, old_value, new_value, reason, actor_user_id, created_at FROM provider_changes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, providerCode: x.provider_code, action: x.action, oldValue: x.old_value ?? null, newValue: x.new_value ?? null, reason: x.reason, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }
}
