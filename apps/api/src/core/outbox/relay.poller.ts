// core/outbox/relay.poller.ts
// Production runner for the transactional-outbox relay. The worker (apps/worker) calls runRelay()
// on an interval, connected as the BYPASSRLS kv_relay role (migration 0018) so it can see every
// tenant's pending events. At shard_count=1 a single poller suffices; scale out by running more
// (FOR UPDATE SKIP LOCKED makes concurrent pollers safe). Handlers are registered by the modules
// (OrdersModule, PaymentsModule, …) into the shared OutboxHandlerRegistry at init.
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
