// core/sharding/shard-router.ts
// Resolves a tenant to its physical shard. Phase 1 runs a single shard (0); the
// router is wired into every write path NOW so that turning on N shards later is
// a config + data-migration change, not a code rewrite (ADR-0007). The directory
// (tenant → shard) is cached; a real lookup table backs it at scale.
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';

@Injectable()
export class ShardRouter {
  private readonly shardCount: number;
  constructor(config: AppConfig) { this.shardCount = Math.max(1, config.shardCount); }

  /** Deterministic tenant → shard mapping (stable hash). Single shard ⇒ always 0. */
  shardFor(tenantId: string): number {
    if (this.shardCount === 1) return 0;
    let h = 2166136261;                       // FNV-1a over the tenant uuid
    for (let i = 0; i < tenantId.length; i++) { h ^= tenantId.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h) % this.shardCount;
  }
}
