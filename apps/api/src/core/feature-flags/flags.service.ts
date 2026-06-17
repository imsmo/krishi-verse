// core/feature-flags/flags.service.ts
// DB-backed feature flags (Law 10: every feature behind a flag, default OFF, kill-switch).
// Resolution for a flag `key` given the caller's tenant/user:
//   • unknown flag → OFF (fail-closed — a typo can't silently enable a feature);
//   • is_enabled=false → OFF for everyone (the KILL-SWITCH);
//   • rules.tenant_ids includes the tenant → ON (explicit allowlist, e.g. demo/anchor tenant);
//   • otherwise deterministic percentage rollout by hash(key + tenant|user) < rollout_pct.
// Cached briefly so a toggle propagates within seconds without hammering the DB.
import { Inject, Injectable } from '@nestjs/common';
import { PgPoolProvider } from '../database/pg-pool.provider';
import { CACHE_SERVICE, CacheService } from '../cache/cache.service';

export interface FlagContext { tenantId?: string; userId?: string }
interface FlagRow { is_enabled: boolean; rollout_pct: number; rules: { tenant_ids?: string[]; plans?: string[]; countries?: string[] } }
const TTL = 30; // seconds — fast kill-switch propagation

@Injectable()
export class FlagsService {
  constructor(private readonly pools: PgPoolProvider, @Inject(CACHE_SERVICE) private readonly cache: CacheService) {}

  async isEnabled(key: string, ctx: FlagContext = {}): Promise<boolean> {
    const flag = await this.load(key);
    if (!flag || !flag.is_enabled) return false;                 // unknown OR kill-switched ⇒ OFF
    const allow = flag.rules?.tenant_ids ?? [];
    if (ctx.tenantId && allow.includes(ctx.tenantId)) return true;
    if (flag.rollout_pct >= 100) return true;
    if (flag.rollout_pct <= 0) return false;
    const subject = `${key}:${ctx.tenantId ?? ctx.userId ?? 'anon'}`;
    return this.bucket(subject) < flag.rollout_pct;
  }

  async assertEnabled(key: string, ctx: FlagContext = {}): Promise<boolean> { return this.isEnabled(key, ctx); }

  private async load(key: string): Promise<FlagRow | null> {
    return this.cache.wrap(`flag:${key}`, TTL, async () => {
      const r = await this.pools.replica(0).query<FlagRow>(
        `SELECT is_enabled, rollout_pct, rules FROM feature_flags WHERE key=$1`, [key]);
      return r.rows[0] ?? null;
    });
  }
  /** Stable 0–99 bucket from a string (deterministic rollout). */
  private bucket(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h) % 100;
  }
}
export const FLAGS_SERVICE = Symbol('FLAGS_SERVICE');
