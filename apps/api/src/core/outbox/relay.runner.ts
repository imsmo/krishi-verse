// core/outbox/relay.runner.ts
// KV-BL-063 — wires the transactional-outbox relay into apps/api itself as an in-process timer.
// Context (S0 classification memo, apps/worker/WORKER-RUNTIME.md "Deferred: domain-handler jobs"):
// OutboxDispatcher (outbox.dispatcher.ts) and runRelay() (relay.poller.ts) are complete and tested,
// but nothing invoked either at runtime, so pending outbox events (payments.payment_succeeded ->
// order confirmed, orders.order_completed -> escrow release + notification fan-out, …) sat forever.
// This runner resolves that via option (a) from the memo: the api runs the dispatcher on its own
// timer — the simplest option, since every module's OutboxHandler already lives in this process and
// registers into the shared OUTBOX_HANDLER_REGISTRY at boot (OrdersModule, PaymentsModule,
// RealtimeFanoutRegistrar, …). See docs/adr/0001-monorepo-modular-monolith.md's 2026-07-10 amendment
// for why this runs here rather than as the standalone apps/outbox-relay/worker satellite.
//
// LIFECYCLE: starts on OnApplicationBootstrap, not OnModuleInit. NestJS guarantees every module's
// onModuleInit() (where handlers register themselves — see RealtimeFanoutRegistrar, OrdersModule,
// PaymentsModule, etc.) completes app-wide BEFORE onApplicationBootstrap fires, so by the time the
// first tick runs, OUTBOX_HANDLER_REGISTRY already has every handler registered. Starting any
// earlier would risk draining events before their handler exists.
//
// CONNECTION: a SEPARATE pg Pool connected as kv_relay (BYPASSRLS, migration 0018) — never the
// request-tier pools from PgPoolProvider (kv_app, RLS-scoped, cannot see other tenants' pending
// events). AppConfig.relay.databaseUrl resolves this (RELAY_DATABASE_URL, falling back to
// DATABASE_URL for local dev); assertProductionSecurity enforces the kv_relay role name in prod.
//
// CONCURRENCY ACROSS PODS: safe by construction. OutboxDispatcher.relayOne() claims one event with
// `FOR UPDATE SKIP LOCKED` (see outbox.dispatcher.ts) — many api pods, each running this same timer,
// simply race to claim distinct rows. No leader election needed (unlike apps/worker's advisory-lock
// jobs, which mutate cross-tenant aggregates a single winner must own).
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfig } from '../config/app-config';
import { METRICS, Metrics } from '../observability/metrics';
import { OUTBOX_HANDLER_REGISTRY } from './event-envelope';
import { OutboxDispatcher, OutboxHandlerRegistry } from './outbox.dispatcher';

/** After this many CONSECUTIVE hard tick failures (relay pool down, etc.), slow the timer down
 *  instead of hammering a dead connection every RELAY_INTERVAL_MS. */
const BACKOFF_AFTER_FAILURES = 5;
const BACKOFF_MULTIPLIER = 10;
const BACKOFF_MAX_MS = 30_000;

@Injectable()
export class OutboxRelayRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(OutboxRelayRunner.name);
  private relayPool: Pool | null = null;
  private dispatcher: OutboxDispatcher | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private stopped = false;
  private consecutiveFailures = 0;
  private batchSize = 100;

  constructor(
    private readonly config: AppConfig,
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  onApplicationBootstrap(): void {
    const relay = this.config.relay;
    if (!relay.enabled) {
      this.log.log('outbox relay timer disabled (RELAY_ENABLED=false) — pending events will NOT be relayed');
      return;
    }
    // Integration/unit specs construct their OWN OutboxDispatcher against an admin pool and call
    // relayBatch() directly (see modules/payments/__tests__/orders-payments-e2e.integration.spec.ts)
    // — a second timer racing the same rows would make those assertions flaky. Never start under test.
    if (this.config.nodeEnv === 'test') {
      this.log.log('outbox relay timer skipped under NODE_ENV=test (specs drive the dispatcher directly)');
      return;
    }
    this.startTimer(relay.databaseUrl, relay.poolMax, relay.intervalMs, relay.batchSize);
  }

  private startTimer(databaseUrl: string, poolMax: number, intervalMs: number, batchSize: number): void {
    this.relayPool = new Pool({ connectionString: databaseUrl, max: poolMax, application_name: 'kv-api-relay' });
    this.relayPool.on('error', (e) => this.log.error(`relay pool error: ${e.message}`));
    this.dispatcher = new OutboxDispatcher(this.relayPool, this.registry, this.metrics);
    this.batchSize = batchSize;
    this.log.log(`outbox relay timer starting (interval=${intervalMs}ms, batch=${batchSize}); registry has ${this.registry.size} event type(s)`);
    this.timer = setInterval(() => { void this.tick(); }, intervalMs);
    void this.tick(); // drain immediately on boot rather than waiting a full interval for the first pass
  }

  /** One relay tick: claim + process up to `batchSize` pending events. Guarded so a slow batch never
   * overlaps the next scheduled tick (a long-running batch must not stack a second one on the same
   * pool/registry). Exposed (not private) so unit tests can invoke it directly. */
  async tick(): Promise<void> {
    if (this.stopped || this.inFlight || !this.dispatcher) return;
    this.inFlight = true;
    try {
      const n = await this.dispatcher.relayBatch(this.batchSize);
      if (n > 0) this.log.log(`relayed ${n} outbox event(s)`);
      this.consecutiveFailures = 0;
    } catch (err) {
      // OutboxDispatcher.relayBatch/relayOne already swallow per-event handler errors (quarantined
      // to 'failed', a DLQ/requeue job retries — see outbox.dispatcher.ts). Reaching this catch means
      // the tick itself failed hard (e.g. the relay pool/connection is down) — it must never crash
      // the api process; the next tick simply retries.
      this.consecutiveFailures++;
      this.metrics.inc('outbox.relay_tick_failed');
      this.log.error(`relay tick failed (#${this.consecutiveFailures} consecutive): ${(err as Error)?.message ?? String(err)}`);
      if (this.consecutiveFailures >= BACKOFF_AFTER_FAILURES) this.backoff();
    } finally {
      this.inFlight = false;
    }
  }

  /** Slow the timer down after repeated hard failures (likely a DB outage) instead of hammering it
   * every RELAY_INTERVAL_MS. One-way for this process's lifetime — a fresh pod picks up the normal
   * cadence again, which is an acceptable trade for staying simple (no self-healing timer state). */
  private backoff(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    const backoffMs = Math.min((this.config.relay.intervalMs || 1) * BACKOFF_MULTIPLIER, BACKOFF_MAX_MS);
    this.timer = setInterval(() => { void this.tick(); }, backoffMs);
    this.log.warn(`relay timer backing off to ${backoffMs}ms after ${this.consecutiveFailures} consecutive failures`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.relayPool) { await this.relayPool.end().catch(() => undefined); this.relayPool = null; }
  }
}
