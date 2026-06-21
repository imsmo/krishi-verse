// apps/admin-api/src/modules/flags-ops/repositories/flags.repository.ts · ALL SQL for flags-ops. READS:
// feature_flags (keyset list + single + FOR UPDATE) and feature_flag_changes (keyset history). WRITES (in the
// caller's tx): create flag, update flag (enable/disable/rollout/targeting/lock), append a change-history row.
// feature_flags is a GLOBAL/god-mode table (PK=key, no id, no tenant_id) — operated only by kv_admin, every
// action audited. Parameterised only; keyset (never OFFSET); bounded. `rules` is the snake_case jsonb shape the
// runtime evaluator reads.
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminPool } from '../../../core/database/admin-pool';
import { FeatureFlag, FlagChangeAction } from '../domain/flag.entity';
import { TargetingRules } from '../domain/rollout';
import { FlagAlreadyExistsError } from '../domain/flags-ops.errors';

function toFlag(r: any): FeatureFlag {
  return FeatureFlag.rehydrate({
    key: r.key, description: r.description ?? null, isEnabled: r.is_enabled, rolloutPct: r.rollout_pct,
    rules: (r.rules ?? {}) as TargetingRules, isLocked: r.is_locked, createdAt: r.created_at ?? null,
  });
}

export interface FlagListQuery { prefix?: string; enabled?: boolean; cursor?: { c: string; key: string }; limit: number; }
export interface ChangeListQuery { flagKey: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class FlagsRepository {
  constructor(private readonly pool: AdminPool) {}

  /* ---------------- feature_flags ---------------- */
  async listFlags(q: FlagListQuery): Promise<FeatureFlag[]> {
    const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'deleted_at IS NULL';
    if (q.prefix) where += ` AND key LIKE ${p(q.prefix.replace(/[%_]/g, (m) => `\\${m}`) + '%')}`;   // escape LIKE metachars
    if (q.enabled !== undefined) where += ` AND is_enabled=${p(q.enabled)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ck = p(q.cursor.key); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND key < ${ck}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT key, description, is_enabled, rollout_pct, rules, is_locked, created_at
         FROM feature_flags WHERE ${where} ORDER BY created_at DESC, key DESC LIMIT ${lp}`, params);
    return r.rows.map(toFlag);
  }

  async getFlag(key: string): Promise<FeatureFlag | null> {
    const r = await this.pool.query(
      `SELECT key, description, is_enabled, rollout_pct, rules, is_locked, created_at FROM feature_flags WHERE key=$1 AND deleted_at IS NULL`, [key]);
    return r.rows[0] ? toFlag(r.rows[0]) : null;
  }
  async getFlagForUpdate(client: PoolClient, key: string): Promise<FeatureFlag | null> {
    const r = await client.query(
      `SELECT key, description, is_enabled, rollout_pct, rules, is_locked, created_at FROM feature_flags WHERE key=$1 AND deleted_at IS NULL FOR UPDATE`, [key]);
    return r.rows[0] ? toFlag(r.rows[0]) : null;
  }

  async createFlag(client: PoolClient, f: { key: string; description: string | null; rolloutPct: number; rules: TargetingRules; actorUserId: string }): Promise<FeatureFlag> {
    try {
      const r = await client.query(
        `INSERT INTO feature_flags (key, description, is_enabled, rollout_pct, rules, is_locked, created_by)
         VALUES ($1,$2,false,$3,$4::jsonb,false,$5)
         RETURNING key, description, is_enabled, rollout_pct, rules, is_locked, created_at`,
        [f.key, f.description, f.rolloutPct, JSON.stringify(f.rules), f.actorUserId]);
      return toFlag(r.rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') throw new FlagAlreadyExistsError(f.key);
      throw e;
    }
  }

  async updateFlag(client: PoolClient, flag: FeatureFlag, actorUserId: string): Promise<void> {
    const s = flag.snapshot();
    await client.query(
      `UPDATE feature_flags SET is_enabled=$2, rollout_pct=$3, rules=$4::jsonb, is_locked=$5, updated_by=$6, updated_at=now() WHERE key=$1`,
      [flag.key, s.isEnabled, s.rolloutPct, JSON.stringify(s.rules), flag.isLocked, actorUserId]);
  }

  /* ---------------- feature_flag_changes (append-only history) ---------------- */
  async insertChange(client: PoolClient, c: { flagKey: string; action: FlagChangeAction; oldValue: unknown; newValue: unknown; reason: string; actorUserId: string }): Promise<void> {
    await client.query(
      `INSERT INTO feature_flag_changes (flag_key, action, old_value, new_value, reason, actor_user_id)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
      [c.flagKey, c.action, c.oldValue != null ? JSON.stringify(c.oldValue) : null, c.newValue != null ? JSON.stringify(c.newValue) : null, c.reason, c.actorUserId]);
  }

  async listChanges(q: ChangeListQuery): Promise<any[]> {
    const params: unknown[] = [q.flagKey]; const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = 'flag_key=$1';
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.pool.query(
      `SELECT id, flag_key, action, old_value, new_value, reason, actor_user_id, created_at
         FROM feature_flag_changes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map((x: any) => ({ id: x.id, flagKey: x.flag_key, action: x.action, oldValue: x.old_value ?? null, newValue: x.new_value ?? null, reason: x.reason, actorUserId: x.actor_user_id, createdAt: x.created_at }));
  }
}
