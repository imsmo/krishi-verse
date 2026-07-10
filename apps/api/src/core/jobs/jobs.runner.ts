// core/jobs/jobs.runner.ts
// KV-BL-P0-9-follow-on — hosts the pilot's TIME/CADENCE-driven domain-handler jobs in-process inside
// apps/api, the same way core/outbox/relay.runner.ts (KV-BL-063) already hosts the EVENT-driven outbox
// relay. Context: apps/worker/WORKER-RUNTIME.md's "Deferred: domain-handler jobs" listed several jobs
// that need module business logic the standalone pg-only apps/worker can't import (settlement-statement
// generation, notification digest, KYC expiry, scheme sync, mandi/weather ingest). S1 resolved the
// EVENT-driven ones (outbox handler execution) with an in-process timer in apps/api. This runner is the
// same option (a) for the CADENCE-driven ones: modules register a `ScheduledJob` into
// `SCHEDULED_JOB_REGISTRY` (mirrors `OUTBOX_HANDLER_REGISTRY`'s registration pattern) at `onModuleInit`,
// and this runner drains the registry with one independent timer PER job, starting `OnApplicationBootstrap`
// (after every module's `onModuleInit` has registered).
//
// SAFETY ACROSS PODS: unlike the outbox relay (safe via `FOR UPDATE SKIP LOCKED` per-event), a cadence
// job like settlement-statement generation is NOT row-race-safe by construction — two pods racing the
// same seller+period could both pass the "un-statemented lines" check before either commits. So each
// tick first takes a Postgres ADVISORY LOCK keyed by the job's name (`apps/worker/src/runtime/leader-lock.ts`'s
// exact algorithm, copied into `scheduled-job.ts`'s `lockKey`) on a DEDICATED connection held for the
// job's duration — only the pod that wins it runs this tick; the rest skip and retry next interval.
//
// CONNECTION: a separate pg Pool connected as kv_relay (BYPASSRLS) — same role as the outbox relay's
// pool (migration 0018) — because cross-tenant cadence jobs (e.g. settlement statements scan every
// tenant's un-statemented lines) cannot go through the request-tier kv_app/RLS pools.
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AppConfig } from '../config/app-config';
import { METRICS, Metrics } from '../observability/metrics';
import { ScheduledJob, lockKey } from './scheduled-job';
import { SCHEDULED_JOB_REGISTRY, ScheduledJobRegistry } from './scheduled-job.registry';

interface JobState { timer: ReturnType<typeof setInterval> | null; inFlight: boolean; }

@Injectable()
export class ScheduledJobsRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(ScheduledJobsRunner.name);
  private pool: Pool | null = null;
  private stopped = false;
  private readonly state = new Map<string, JobState>();

  constructor(
    private readonly config: AppConfig,
    @Inject(SCHEDULED_JOB_REGISTRY) private readonly registry: ScheduledJobRegistry,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  onApplicationBootstrap(): void {
    const jobs = this.config.jobs;
    if (!jobs.enabled) {
      this.log.log('scheduled-jobs runner disabled (JOBS_ENABLED=false) — no cadence jobs will run in this process');
      return;
    }
    // Same convention as OutboxRelayRunner: never start under test — unit/integration specs drive
    // job.run(pool) or runner.tick(job) directly, so a live timer racing those assertions would be flaky.
    if (this.config.nodeEnv === 'test') {
      this.log.log('scheduled-jobs runner skipped under NODE_ENV=test (specs drive jobs directly)');
      return;
    }
    const registered = this.registry.list();
    if (registered.length === 0) {
      this.log.log('scheduled-jobs runner has no registered jobs — nothing to start');
      return;
    }
    this.pool = new Pool({ connectionString: jobs.databaseUrl, max: jobs.poolMax, application_name: 'kv-api-jobs' });
    this.pool.on('error', (e) => this.log.error(`jobs pool error: ${e.message}`));
    this.log.log(`scheduled-jobs runner starting ${registered.length} job(s): ${registered.map((j) => j.name).join(', ')}`);
    for (const job of registered) this.startJobTimer(job);
  }

  private startJobTimer(job: ScheduledJob): void {
    const st: JobState = { timer: null, inFlight: false };
    this.state.set(job.name, st);
    st.timer = setInterval(() => { void this.tick(job); }, job.intervalMs);
    void this.tick(job); // drain immediately on boot rather than waiting a full interval for the first pass
  }

  /** One tick for one job: try the advisory lock, run under it if won, always release + isolate errors.
   *  Exposed (not private) so unit tests can invoke it directly without a live timer. */
  async tick(job: ScheduledJob): Promise<void> {
    if (this.stopped || !this.pool) return;
    const st = this.state.get(job.name);
    if (st?.inFlight) return; // a slow run must never overlap the next scheduled tick for the SAME job
    if (st) st.inFlight = true;
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      const key = lockKey(job.name);
      const acquired = (await client.query('SELECT pg_try_advisory_lock($1) AS ok', [key])).rows[0]?.ok === true;
      if (!acquired) {
        this.log.log(`job "${job.name}" skipped this tick (advisory lock held by another pod)`);
        return;
      }
      try {
        const t0 = Date.now();
        await job.run(this.pool);
        this.metrics.observe('jobs.tick_duration_ms', Date.now() - t0, { job: job.name, ok: 'true' });
      } catch (err) {
        // A job throwing must NEVER crash the api process, and must never block other jobs' timers
        // (each job has its own independent setInterval — this catch only isolates THIS job's failure).
        this.metrics.inc('jobs.tick_failed', { job: job.name });
        this.log.error(`job "${job.name}" failed: ${(err as Error)?.message ?? String(err)}`);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => undefined);
      }
    } catch (err) {
      // Connection-level failure (pool down, etc.) — same isolation guarantee as a job failure.
      this.metrics.inc('jobs.tick_connection_failed', { job: job.name });
      this.log.error(`job "${job.name}" tick could not acquire a connection: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      client?.release();
      if (st) st.inFlight = false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    for (const st of this.state.values()) { if (st.timer) clearInterval(st.timer); st.timer = null; }
    this.state.clear();
    if (this.pool) { await this.pool.end().catch(() => undefined); this.pool = null; }
  }
}
