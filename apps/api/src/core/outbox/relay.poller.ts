// core/outbox/relay.poller.ts
// A standalone, abort-signal-driven relay loop for the transactional outbox — connect as the
// BYPASSRLS kv_relay role (migration 0018) so it can see every tenant's pending events, then call
// runRelay(dispatcher) to drain it until aborted. At shard_count=1 a single poller suffices; scale
// out by running more (FOR UPDATE SKIP LOCKED makes concurrent pollers safe). Handlers are
// registered by the modules (OrdersModule, PaymentsModule, …) into the shared OutboxHandlerRegistry
// at init.
//
// PRODUCTION WIRING (KV-BL-063): apps/api's own timer, core/outbox/relay.runner.ts
// (OutboxRelayRunner), does NOT call this loop — it drives OutboxDispatcher.relayBatch() directly
// from a NestJS-lifecycle-managed setInterval so it can start/stop cleanly with the app and guard
// against overlapping ticks. This file is kept as a reusable, framework-free primitive (e.g. for a
// future standalone extraction — see docs/adr/0001-monorepo-modular-monolith.md's 2026-07-10
// amendment) and is exercised directly by modules/payments/pilot-e2e/relay-tick.ts's one-shot drain.
import { OutboxDispatcher } from './outbox.dispatcher';

export interface RelayLoopOptions {
  batch?: number;          // max events per tick
  idleMs?: number;         // sleep when the queue is empty
  busyMs?: number;         // sleep when more may remain
  signal?: AbortSignal;    // for graceful shutdown
}

/** Run the relay loop until aborted. Backs off when idle; drains quickly when busy. */
export async function runRelay(dispatcher: OutboxDispatcher, opts: RelayLoopOptions = {}): Promise<void> {
  const batch = opts.batch ?? 100;
  const idleMs = opts.idleMs ?? 1000;
  const busyMs = opts.busyMs ?? 5;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  while (!opts.signal?.aborted) {
    let processed = 0;
    try { processed = await dispatcher.relayBatch(batch); }
    catch { processed = 0; }   // a relay-loop error must never crash the worker; next tick retries
    await sleep(processed > 0 ? busyMs : idleMs);
  }
}
