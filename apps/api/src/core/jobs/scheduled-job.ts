// core/jobs/scheduled-job.ts · KV-BL-P0-9-follow-on — the contract a cadence (time/scheduled) job
// implements to run in-process inside apps/api, mirroring how core/outbox/relay.runner.ts already
// runs the outbox relay on a timer (see WORKER-RUNTIME.md "Deferred: domain-handler jobs" + ADR-0001's
// 2026-07-10 amendment). Unlike the outbox relay (safe with N racing pods via FOR UPDATE SKIP LOCKED),
// a cadence job like settlement-statement generation is NOT row-race-safe by construction, so each job
// runs under a Postgres ADVISORY LOCK — only the pod that wins it runs this tick (apps/worker's
// leader-lock pattern, `apps/worker/src/runtime/leader-lock.ts`, copied here verbatim).
import type { Pool } from 'pg';

/** A named, cadence-driven job hosted by `ScheduledJobsRunner`. `run` receives the runner's shared
 *  BYPASSRLS pool (kv_relay) for any cross-tenant work — mirrors `SettlementStatementsJob`'s
 *  `systemPool` parameter so the same job class runs unmodified whether wired here or in apps/worker. */
export interface ScheduledJob {
  readonly name: string;
  readonly intervalMs: number;
  run(pool: Pool): Promise<void>;
}

/** Deterministic 31-bit lock key from a job name (fits a signed int4 advisory key). Identical
 *  algorithm to `apps/worker/src/runtime/leader-lock.ts`'s `lockKey` — kept in sync deliberately so a
 *  job name maps to the same lock whether it ever runs in apps/worker or here (no double-booking two
 *  processes under different keys for what is conceptually "the same job"). */
export function lockKey(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 0x7fffffff; // 0 .. 2^31-1
}
